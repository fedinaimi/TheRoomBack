const Reservation = require('../models/Reservation');
const TimeSlot = require('../models/TimeSlot');
const sendEmail = require('../utils/sendEmail');
const Notification = require('../models/Notifications');
const ApprovedReservation = require("../models/ApprovedReservation");
const DeclinedReservation = require("../models/DeclinedReservation");
exports.createReservation = async (req, res) => {
  try {
    const { scenario, chapter, timeSlot, name, email, phone, language } = req.body;

    // Validate required fields
    if (!scenario || !chapter || !timeSlot || !name || !email || !phone) {
      return res.status(400).json({
        message: "Tous les champs sont obligatoires : scénario, chapitre, créneau horaire, nom, email et téléphone.",
      });
    }

    // Check if the time slot exists and is available
    const timeSlotData = await TimeSlot.findById(timeSlot);
    if (!timeSlotData || timeSlotData.status !== "available") {
      return res.status(400).json({ message: "Le créneau horaire est déjà réservé ou indisponible." });
    }

    // Define today's start and end times
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    // Fetch today's reservations for the user
    const approvedReservationsToday = await ApprovedReservation.find({
      email,
      phone,
      createdAt: { $gte: todayStart, $lte: todayEnd },
    });

    const pendingReservationsToday = await Reservation.find({
      email,
      phone,
      createdAt: { $gte: todayStart, $lte: todayEnd },
    });

    const allReservationsToday = [...approvedReservationsToday, ...pendingReservationsToday];

    console.log("All Reservations Today:", allReservationsToday);

    // Check if the user already reserved the same scenario today (any chapter)
    const sameScenarioReservation = allReservationsToday.find(
      (res) => res.scenario.toString() === scenario
    );

    if (sameScenarioReservation) {
      return res.status(400).json({
        message: "Vous avez déjà réservé un créneau pour ce scénario aujourd'hui.",
      });
    }

    // Limit to 3 reservations for different scenarios per day
    if (allReservationsToday.length >= 3) {
      return res.status(400).json({
        message: "Vous ne pouvez effectuer qu'un maximum de 3 réservations par jour.",
      });
    }

    // Create a new reservation
    const reservation = new Reservation({
      scenario,
      chapter,
      timeSlot,
      name,
      email,
      phone,
      language,
    });
    await reservation.save();

    // Update time slot status
    timeSlotData.status = "pending";
    await timeSlotData.save();

    // Send notification to admin
    const notification = new Notification({
      message: `Nouvelle réservation par ${name}`,
      reservationId: reservation._id,
      details: `Réservation pour le scénario ID: ${scenario}, chapitre ID: ${chapter}.`,
    });
    await notification.save();

    // Send confirmation email
    const customerEmailContent = `
      <html>
        <head><title>Confirmation de Réservation</title></head>
        <body>
          <h1>Votre réservation a été reçue</h1>
          <p><strong>Nom :</strong> ${name}</p>
          <p><strong>Email :</strong> ${email}</p>
          <p><strong>Téléphone :</strong> ${phone}</p>
          <p><strong>Créneau horaire :</strong> ${new Date(timeSlotData.startTime).toLocaleString()} - ${new Date(timeSlotData.endTime).toLocaleString()}</p>
          <p>Veuillez attendre que l'administrateur approuve votre réservation.</p>
        </body>
      </html>
    `;
    await sendEmail(email, "Confirmation de Réservation", customerEmailContent);

    res.status(201).json({
      message: "Votre réservation a été créée avec succès.",
      reservation,
    });
  } catch (error) {
    console.error("Erreur lors de la création de la réservation :", error.message || error);
    res.status(500).json({ message: "Erreur interne du serveur. Veuillez réessayer plus tard." });
  }
};


// Get all reservations (admin)


exports.getAllReservations = async (req, res) => {
  try {
    // Fetch data from all collections
    const reservations = await Reservation.find()
      .populate('scenario')
      .populate('chapter')
      .populate('timeSlot');

    const approvedReservations = await ApprovedReservation.find()
      .populate('scenario')
      .populate('chapter')
      .populate('timeSlot');

    const declinedReservations = await DeclinedReservation.find()
      .populate('scenario')
      .populate('chapter')
      .populate('timeSlot');

    // Send data grouped by collection
    res.status(200).json({
      reservations,
      approvedReservations,
      declinedReservations,
    });
  } catch (error) {
    console.error('Error fetching reservations:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};






exports.updateReservationStatus = async (req, res) => {
  try {
    const { status } = req.body; // 'approved' or 'declined'
    const { source, reservationId } = req.params; // Source and ID of the reservation

    // Fetch the reservation based on source
    let reservation;
    if (source === "reservations") {
      reservation = await Reservation.findById(reservationId).populate("timeSlot");
    } else if (source === "approvedReservations") {
      reservation = await ApprovedReservation.findById(reservationId).populate("timeSlot");
    } else if (source === "declinedReservations") {
      reservation = await DeclinedReservation.findById(reservationId).populate("timeSlot");
    } else {
      return res.status(400).json({ message: "Invalid source specified." });
    }

    // Validate if reservation exists
    if (!reservation) {
      return res.status(404).json({ message: "Reservation not found." });
    }

    const timeSlot = reservation.timeSlot;

    // Validate if time slot exists
    if (!timeSlot) {
      return res.status(400).json({ message: "Time slot not found for this reservation." });
    }

    if (status === "approved") {
      // Move to ApprovedReservation collection
      const approvedReservation = new ApprovedReservation({
        ...reservation.toObject(),
        status: "approved",
      });
      await approvedReservation.save();

      // Update time slot to "booked"
      timeSlot.status = "booked";
      timeSlot.isAvailable = false;
      await timeSlot.save();

      // Send approval email
      const emailContent = `
        <html>
          <head><title>Reservation Approved</title></head>
          <body style="font-family: Arial, sans-serif; color: #333;">
            <h1 style="text-align: center; color: #4CAF50;">Your Reservation Has Been Approved</h1>
            <p>Dear ${reservation.name},</p>
            <p>Your reservation has been successfully approved.</p>
            <p><strong>Reservation Details:</strong></p>
            <ul>
              <li><strong>Reservation ID:</strong> ${reservation._id}</li>
              <li><strong>Time Slot:</strong> ${new Date(timeSlot.startTime).toLocaleString()} - ${new Date(timeSlot.endTime).toLocaleString()}</li>
              <li><strong>Status:</strong> Approved</li>
            </ul>
            <p>Thank you for choosing our service!</p>
          </body>
        </html>
      `;
      await sendEmail(reservation.email, "Reservation Approved", emailContent);

      // Remove the reservation from the original source
      if (source === "declinedReservations") {
        await DeclinedReservation.findByIdAndDelete(reservationId);
      } else {
        await Reservation.findByIdAndDelete(reservationId);
      }
    } else if (status === "declined") {
      // Move to DeclinedReservation collection
      const declinedReservation = new DeclinedReservation({
        ...reservation.toObject(),
        status: "declined",
      });
      await declinedReservation.save();

      // Update time slot to "available"
      timeSlot.status = "available";
      timeSlot.isAvailable = true;
      await timeSlot.save();

      // Send decline email
      const emailContent =
        source === "approvedReservations"
          ? `
          <html>
            <head><title>Reservation Declined</title></head>
            <body style="font-family: Arial, sans-serif; color: #333;">
              <h1 style="text-align: center; color: #FF5733;">Reservation Declined Due to Technical Issues</h1>
              <p>Dear ${reservation.name},</p>
              <p>We regret to inform you that your reservation has been declined due to unforeseen technical issues.</p>
              <p>We apologize for the inconvenience caused.</p>
              <p><strong>Reservation Details:</strong></p>
              <ul>
                <li><strong>Reservation ID:</strong> ${reservation._id}</li>
                <li><strong>Time Slot:</strong> ${new Date(timeSlot.startTime).toLocaleString()} - ${new Date(timeSlot.endTime).toLocaleString()}</li>
                <li><strong>Status:</strong> Declined</li>
              </ul>
            </body>
          </html>
        `
          : `
          <html>
            <head><title>Reservation Declined</title></head>
            <body style="font-family: Arial, sans-serif; color: #333;">
              <h1 style="text-align: center; color: #FF5733;">Reservation Declined</h1>
              <p>Dear ${reservation.name},</p>
              <p>Your reservation has been declined.</p>
              <p>Please choose another time slot and try again.</p>
              <p><strong>Reservation Details:</strong></p>
              <ul>
                <li><strong>Reservation ID:</strong> ${reservation._id}</li>
                <li><strong>Time Slot:</strong> ${new Date(timeSlot.startTime).toLocaleString()} - ${new Date(timeSlot.endTime).toLocaleString()}</li>
                <li><strong>Status:</strong> Declined</li>
              </ul>
            </body>
          </html>
        `;
      await sendEmail(reservation.email, "Reservation Declined", emailContent);

      // Remove the reservation from the original source
      if (source === "approvedReservations") {
        await ApprovedReservation.findByIdAndDelete(reservationId);
      } else {
        await Reservation.findByIdAndDelete(reservationId);
      }
    } else {
      return res.status(400).json({ message: "Invalid status. Use 'approved' or 'declined'." });
    }

    res.status(200).json({ message: "Reservation status updated successfully." });
  } catch (error) {
    console.error("Error updating reservation status:", error);
    res.status(500).json({ message: "Internal Server Error." });
  }
};

exports.deleteReservation = async (req, res) => {
  const { source, reservationId } = req.params;

  if (!source || !reservationId) {
    return res.status(400).json({ message: "Source or reservation ID is missing." });
  }

  try {
    let deletedReservation;

    // Check the source and delete from the respective schema
    if (source === "reservations") {
      deletedReservation = await Reservation.findByIdAndDelete(reservationId);
    } else if (source === "approvedReservations") {
      deletedReservation = await ApprovedReservation.findByIdAndDelete(reservationId);
    } else if (source === "declinedReservations") {
      deletedReservation = await DeclinedReservation.findByIdAndDelete(reservationId);
    } else {
      return res.status(400).json({ message: "Invalid source specified." });
    }

    if (!deletedReservation) {
      return res.status(404).json({ message: "Reservation not found." });
    }

    res.status(200).json({ message: "Reservation deleted successfully." });
  } catch (error) {
    console.error("Error deleting reservation:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

// Get reservation by ID (admin)
exports.getReservationById = async (req, res) => {
  try {
    const reservation = await Reservation.findById(req.params.id)
      .populate('scenario')
      .populate('chapter')
      .populate('timeSlot');
    if (!reservation) {
      return res.status(404).json({ message: 'Reservation not found' });
    }
    res.status(200).json(reservation);
  } catch (error) {
    console.error('Error fetching reservation:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};
