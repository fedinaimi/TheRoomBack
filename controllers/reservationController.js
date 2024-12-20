const Reservation = require('../models/Reservation');
const TimeSlot = require('../models/TimeSlot');
const sendEmail = require('../utils/sendEmail');
const Notification = require('../models/Notifications');
const ApprovedReservation = require("../models/ApprovedReservation");
const DeclinedReservation = require("../models/DeclinedReservation");
const Scenario = require('../models/Scenario');
const Chapter = require('../models/Chapter');
const User = require('../models/User');
const deletedReservationSchema = require('../models/DeletedReservation');
const DeletedReservation = require('../models/DeletedReservation');

exports.createReservation = async (req, res) => {
  try {
    const { scenario, chapter, timeSlot, name, email, phone, language, people } = req.body;

    // Validate required fields
    if (!scenario || !chapter || !timeSlot || !name || !email || !phone || !people) {
      return res.status(400).json({
        message:
          "Tous les champs sont obligatoires : scénario, chapitre, créneau horaire, nom, email, téléphone et nombre de personnes.",
      });
    }

    if (people <= 0) {
      return res.status(400).json({
        message: "Le nombre de personnes doit être supérieur à zéro.",
      });
    }

    // Check if the time slot exists
    const timeSlotData = await TimeSlot.findById(timeSlot);
    if (!timeSlotData) {
      return res.status(404).json({ message: "Le créneau horaire n'existe pas." });
    }

    // Check if the time slot is available
    if (timeSlotData.status !== "available") {
      return res
        .status(400)
        .json({ message: "Le créneau horaire est déjà réservé ou indisponible." });
    }

    // Determine the day based on the selected time slot
    const slotDate = new Date(timeSlotData.startTime);
    const dayStart = new Date(
      slotDate.getFullYear(),
      slotDate.getMonth(),
      slotDate.getDate(),
      0,
      0,
      0,
      0
    );
    const dayEnd = new Date(dayStart);
    dayEnd.setHours(23, 59, 59, 999);

    // Fetch scenario and chapter details (optional check)
    const scenarioDoc = await Scenario.findById(scenario);
    if (!scenarioDoc) {
      return res.status(404).json({ message: "Scénario introuvable." });
    }
    const chapterDoc = await Chapter.findById(chapter);
    if (!chapterDoc) {
      return res.status(404).json({ message: "Chapitre introuvable." });
    }

    const scenarioName = scenarioDoc.name || `Scénario (ID: ${scenario})`;
    const chapterName = chapterDoc.name || `Chapitre (ID: ${chapter})`;

    // Fetch reservations for this user (both approved and pending) and filter by the same day
    const userApprovedReservations = await ApprovedReservation.find({ email, phone }).populate(
      "timeSlot"
    );
    const userPendingReservations = await Reservation.find({ email, phone }).populate("timeSlot");

    const approvedReservationsThisDay = userApprovedReservations.filter((resv) => {
      const resvDate = new Date(resv.timeSlot.startTime);
      return resvDate >= dayStart && resvDate <= dayEnd;
    });

    const pendingReservationsThisDay = userPendingReservations.filter((resv) => {
      const resvDate = new Date(resv.timeSlot.startTime);
      return resvDate >= dayStart && resvDate <= dayEnd;
    });

    const allReservationsThisDay = [...approvedReservationsThisDay, ...pendingReservationsThisDay];

    // Check if the user already reserved this scenario and chapter on this day
    const sameScenarioChapterReservation = allReservationsThisDay.find(
      (resv) =>
        resv.scenario.toString() === scenario.toString() &&
        resv.chapter.toString() === chapter.toString()
    );

    if (sameScenarioChapterReservation) {
      return res.status(400).json({
        message:
          "Vous avez déjà réservé un créneau pour ce scénario et ce chapitre aujourd'hui.",
      });
    }

    // Limit to 3 total reservations per user per day
    if (allReservationsThisDay.length >= 3) {
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
      people,
    });
    await reservation.save();

    // Update time slot status to pending
    timeSlotData.status = "pending";
    await timeSlotData.save();

    // Format times for emails
    const startTimeLocal = new Date(timeSlotData.startTime).toLocaleString("fr-FR", {
      timeZone: "Africa/Tunis",
      hour12: false,
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    const endTimeLocal = new Date(timeSlotData.endTime).toLocaleString("fr-FR", {
      timeZone: "Africa/Tunis",
      hour12: false,
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    // Confirmation email to customer
    const customerEmailSubject = "Restez informé : Votre réservation est en attente d'approbation";
    const customerEmailContent = `
  <html>
  <head>
  <title>Confirmation de Réservation</title>
  <meta charset="UTF-8"/>
  <style>
    body {
      font-family: Arial, sans-serif; background:#f5f5f5; margin:0; padding:0; color:#333;
    }
    .email-container {
      max-width:600px; margin:30px auto; background:#ffffff;
      border-radius:8px; overflow:hidden; border:1px solid #ddd;
    }
    .header {
      background:#4a90e2; color:#ffffff; padding:20px; text-align:center;
    }
    .header h1 { margin:0; font-size:24px; }
    .content { padding:20px; }
    .content h2 { margin-top:0; }
    .details p { margin:5px 0; }
    .footer {
      background:#f0f0f0; padding:10px; text-align:center; font-size:14px; color:#666;
    }
    .highlight { color:red; font-weight:bold; }
  </style>
  </head>
  <body>
    <div class="email-container">
      <div class="header">
        <h1>Confirmation de votre réservation</h1>
      </div>
      <div class="content">
        <h2>Bonjour ${name},</h2>
        <p>Nous avons bien reçu votre demande de réservation. Voici les détails :</p>
        <div class="details">
          <p><strong>Nom :</strong> ${name}</p>
          <p><strong>Email :</strong> ${email}</p>
          <p><strong>Téléphone :</strong> ${phone}</p>
          <p><strong>Nombre de personnes :</strong> ${people}</p>
          <p><strong>Scénario :</strong> ${scenarioName}</p>
          <p><strong>Chapitre :</strong> ${chapterName}</p>
          <p><strong>Créneau horaire :</strong> Du ${startTimeLocal} au ${endTimeLocal}</p>
        </div>
        <p class="highlight">Veuillez patienter, un administrateur doit approuver votre réservation.</p>
        <p>Merci de votre confiance,</p>
        <p>L'équipe de Réservation</p>
      </div>
      <div class="footer">
        &copy; ${new Date().getFullYear()} Votre Société - Tous droits réservés.
      </div>
    </div>
  </body>
  </html>
`;

    await sendEmail(email, customerEmailSubject, customerEmailContent);

    // Notify admins
    const admins = await User.find({ usertype: { $in: ["admin", "subadmin"] } });
    const adminEmailSubject = "Nouvelle réservation en attente d'approbation";
    const adminEmailContent = `
      <html>
      <head>
      <title>Nouvelle Réservation</title>
      <meta charset="UTF-8"/>
      <style>
        body {
          font-family: Arial, sans-serif; background:#f5f5f5; margin:0; padding:0; color:#333;
        }
        .email-container {
          max-width:600px; margin:30px auto; background:#ffffff;
          border-radius:8px; overflow:hidden; border:1px solid #ddd;
        }
        .header {
          background:#d9534f; color:#ffffff; padding:20px; text-align:center;
        }
        .header h1 { margin:0; font-size:22px; }
        .content { padding:20px; }
        .content h2 { margin-top:0; }
        .details p { margin:5px 0; }
        .footer {
          background:#f0f0f0; padding:10px; text-align:center; font-size:14px; color:#666;
        }
        .highlight { color:red; font-weight:bold; }
        .action-button {
          display: inline-block; background-color: #4CAF50; color: white; text-align: center;
          padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-top: 20px;
        }
      </style>
      </head>
      <body>
        <div class="email-container">
          <div class="header">
            <h1>Nouvelle Réservation en Attente</h1>
          </div>
          <div class="content">
            <h2>Bonjour,</h2>
            <p>Un nouvel utilisateur a effectué une réservation. Voici les détails :</p>
            <div class="details">
              <p><strong>Nom :</strong> ${name}</p>
              <p><strong>Email :</strong> ${email}</p>
              <p><strong>Téléphone :</strong> ${phone}</p>
              <p><strong>Nombre de personnes :</strong> ${people}</p>
              <p><strong>Scénario :</strong> ${scenarioName}</p>
              <p><strong>Chapitre :</strong> ${chapterName}</p>
              <p><strong>Créneau horaire :</strong> Du ${startTimeLocal} au ${endTimeLocal}</p>
            </div>
            <p class="highlight">Veuillez vous connecter à votre tableau de bord d'administration pour approuver ou rejeter cette réservation.</p>
            <a href="https://www.dashboard.theroom.tn/dashboard/reservations" class="action-button">
              Gérer les Réservations
            </a>
          </div>
          <div class="footer">
            &copy; ${new Date().getFullYear()} Votre Société - Tous droits réservés.
          </div>
        </div>
      </body>
      </html>
    `;

    for (const adminUser of admins) {
      await sendEmail(adminUser.email, adminEmailSubject, adminEmailContent);
    }

    return res.status(201).json({
      message: "Votre réservation a été créée avec succès.",
      reservation,
    });
  } catch (error) {
    console.error("Erreur lors de la création de la réservation :", error.message || error);
    return res
      .status(500)
      .json({ message: "Erreur interne du serveur. Veuillez réessayer plus tard." });
  }
};


// Get all reservations (admin)


exports.getAllReservations = async (req, res) => {
  try {
    // Fetch data from all collections
    const reservations = await Reservation.find()
      .populate("scenario")
      .populate("chapter")
      .populate("timeSlot");

    const approvedReservations = await ApprovedReservation.find()
      .populate("scenario")
      .populate("chapter")
      .populate("timeSlot");

    const declinedReservations = await DeclinedReservation.find()
      .populate("scenario")
      .populate("chapter")
      .populate("timeSlot");

    const deletedReservations = await DeletedReservation.find()
      .populate("scenario")
      .populate("chapter")
      .populate("timeSlot");

    // Send data grouped by collection
    res.status(200).json({
      reservations,
      approvedReservations,
      declinedReservations,
      deletedReservations,
    });
  } catch (error) {
    console.error("Error fetching reservations:", error);
    res.status(500).json({ message: "Internal Server Error" });
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
    let reservation;

    // Retrieve the reservation based on the source
    if (source === "reservations") {
      reservation = await Reservation.findById(reservationId);
    } else if (source === "approvedReservations") {
      reservation = await ApprovedReservation.findById(reservationId);
    } else if (source === "declinedReservations") {
      reservation = await DeclinedReservation.findById(reservationId);
    } else {
      return res.status(400).json({ message: "Invalid source specified." });
    }

    if (!reservation) {
      return res.status(404).json({ message: "Reservation not found." });
    }

    // Check if the associated time slot is in the past
    const timeSlot = await TimeSlot.findById(reservation.timeSlot);
    if (timeSlot && new Date(timeSlot.startTime) < new Date()) {
      // If the time slot is in the past, move to DeletedReservation
      await DeletedReservation.create({
        scenario: reservation.scenario,
        chapter: reservation.chapter,
        timeSlot: reservation.timeSlot,
        name: reservation.name,
        email: reservation.email,
        phone: reservation.phone,
        language: reservation.language,
        createdAt: reservation.createdAt,
        status: "deleted",
        people: reservation.people,
      });

      // Delete the reservation from the original collection
      if (source === "reservations") {
        await Reservation.findByIdAndDelete(reservationId);
      } else if (source === "approvedReservations") {
        await ApprovedReservation.findByIdAndDelete(reservationId);
      } else if (source === "declinedReservations") {
        await DeclinedReservation.findByIdAndDelete(reservationId);
      }

      return res.status(200).json({ message: "Reservation deleted and moved to DeletedReservation." });
    } else {
      // If the time slot is not in the past, just delete the reservation
      await DeletedReservation.create({
        scenario: reservation.scenario,
        chapter: reservation.chapter,
        timeSlot: reservation.timeSlot,
        name: reservation.name,
        email: reservation.email,
        phone: reservation.phone,
        language: reservation.language,
        createdAt: reservation.createdAt,
        status: "deleted",
        people: reservation.people,
      });

      if (source === "reservations") {
        await Reservation.findByIdAndDelete(reservationId);
      } else if (source === "approvedReservations") {
        await ApprovedReservation.findByIdAndDelete(reservationId);
      } else if (source === "declinedReservations") {
        await DeclinedReservation.findByIdAndDelete(reservationId);
      }

      return res.status(200).json({ message: "Reservation deleted and moved to DeletedReservation." });
    }
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
