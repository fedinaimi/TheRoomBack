
const Reservation = require("../models/Reservation");
const TimeSlot = require("../models/TimeSlot");
const sendEmail = require("../utils/sendEmail");
const Notification = require("../models/Notifications");
const ApprovedReservation = require("../models/ApprovedReservation");
const DeclinedReservation = require("../models/DeclinedReservation");
const Scenario = require("../models/Scenario");
const Chapter = require("../models/Chapter");
const User = require("../models/User");
const DeletedReservation = require("../models/DeletedReservation");

// Create a new reservation
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

    // Fetch scenario and chapter details
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

    // **Fixed Logic**: Block only overlapping parallel time slots in other chapters of the same scenario
    const parallelChapters = await Chapter.find({
      scenario: scenarioDoc._id,
      _id: { $ne: chapterDoc._id },
    });

    if (parallelChapters.length > 0) {
      const parallelChapterIds = parallelChapters.map((chap) => chap._id);

      const parallelTimeSlots = await TimeSlot.find({
        chapter: { $in: parallelChapterIds },
        $and: [
          { startTime: { $lt: timeSlotData.endTime } }, // Overlaps with current time slot's end
          { endTime: { $gt: timeSlotData.startTime } }, // Overlaps with current time slot's start
        ],
      });

      const bulkOps = parallelTimeSlots
        .filter((slot) => slot.status === "available")
        .map((slot) => ({
          updateOne: {
            filter: { _id: slot._id },
            update: { status: "blocked", isAvailable: false, blockedBy: reservation._id },
          },
        }));

      if (bulkOps.length > 0) {
        await TimeSlot.bulkWrite(bulkOps);
        console.log("Blocked parallel time slots:", bulkOps.map((op) => op.updateOne.filter._id));
      }
    }

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
    return res.status(500).json({
      message: "Erreur interne du serveur. Veuillez réessayer plus tard.",
    });
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

// Update reservation status (approve or decline)
exports.updateReservationStatus = async (req, res) => {
  try {
    const { status } = req.body; // 'approved' or 'declined'
    const { source, reservationId } = req.params; // Source and ID of the reservation

    // Validate status
    if (!["approved", "declined"].includes(status)) {
      return res.status(400).json({ message: "Statut invalide. Utilisez 'approved' ou 'declined'." });
    }

    // Fetch the reservation based on source
    let reservation;
    if (source === "reservations") {
      reservation = await Reservation.findById(reservationId).populate("timeSlot chapter scenario");
    } else if (source === "approvedReservations") {
      reservation = await ApprovedReservation.findById(reservationId).populate("timeSlot chapter scenario");
    } else if (source === "declinedReservations") {
      reservation = await DeclinedReservation.findById(reservationId).populate("timeSlot chapter scenario");
    } else {
      return res.status(400).json({ message: "Source invalide spécifié." });
    }

    // Validate if reservation exists
    if (!reservation) {
      return res.status(404).json({ message: "Réservation non trouvée." });
    }

    const timeSlot = reservation.timeSlot;

    // Validate if time slot exists
    if (!timeSlot) {
      return res.status(400).json({ message: "Créneau horaire non trouvé pour cette réservation." });
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

      // **Fixed Logic**: Block only overlapping parallel time slots in other chapters of the same scenario
      const scenarioId = reservation.scenario._id;
      const chapterId = reservation.chapter._id;

      // Find all chapters in the same scenario excluding the current one
      const parallelChapters = await Chapter.find({
        scenario: scenarioId,
        _id: { $ne: chapterId },
      });

      if (parallelChapters.length > 0) {
        // Extract chapter IDs
        const parallelChapterIds = parallelChapters.map((chap) => chap._id);

        // Find all time slots in parallel chapters that overlap with the selected time slot
        const parallelTimeSlots = await TimeSlot.find({
          chapter: { $in: parallelChapterIds },
          $and: [
            { startTime: { $lt: timeSlot.endTime } }, // Overlaps with current time slot's end
            { endTime: { $gt: timeSlot.startTime } }, // Overlaps with current time slot's start
          ],
        });

        // Update the status of these parallel time slots to 'blocked' if they are 'available'
        const bulkOps = parallelTimeSlots
          .filter((slot) => slot.status === "available")
          .map((slot) => ({
            updateOne: {
              filter: { _id: slot._id },
              update: { status: "blocked", blockedBy: approvedReservation._id, isAvailable: false },
            },
          }));

        if (bulkOps.length > 0) {
          await TimeSlot.bulkWrite(bulkOps);
          console.log("Blocked parallel time slots:", bulkOps.map((op) => op.updateOne.filter._id));
        }
      }

      // Send approval email to customer
      const emailContent = `
        <html>
          <head><title>Reservation Approuvée</title></head>
          <body style="font-family: Arial, sans-serif; color: #333;">
            <h1 style="text-align: center; color: #4CAF50;">Votre réservation a été approuvée</h1>
            <p>Bonjour ${reservation.name},</p>
            <p>Votre réservation a été approuvée avec succès.</p>
            <p><strong>Détails de la réservation :</strong></p>
            <ul>
              <li><strong>ID de la réservation :</strong> ${reservation._id}</li>
              <li><strong>Créneau horaire :</strong> ${new Date(timeSlot.startTime).toLocaleString("fr-FR", { timeZone: "Africa/Tunis" })} - ${new Date(timeSlot.endTime).toLocaleString("fr-FR", { timeZone: "Africa/Tunis" })}</li>
              <li><strong>Statut :</strong> Approuvée</li>
            </ul>
            <p>Merci d'avoir choisi notre service !</p>
          </body>
        </html>
      `;
      await sendEmail(reservation.email, "Réservation Approuvée", emailContent);

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

      // **Fixed Logic**: Unblock only overlapping parallel time slots in other chapters of the same scenario
      const scenarioId = reservation.scenario._id;
      const chapterId = reservation.chapter._id;

      // Find all chapters in the same scenario excluding the current one
      const parallelChapters = await Chapter.find({
        scenario: scenarioId,
        _id: { $ne: chapterId },
      });

      if (parallelChapters.length > 0) {
        // Extract chapter IDs
        const parallelChapterIds = parallelChapters.map((chap) => chap._id);

        // Find all time slots in parallel chapters that overlap with the selected time slot
        const parallelTimeSlots = await TimeSlot.find({
          chapter: { $in: parallelChapterIds },
          $and: [
            { startTime: { $lt: timeSlot.endTime } }, // Overlaps with current time slot's end
            { endTime: { $gt: timeSlot.startTime } }, // Overlaps with current time slot's start
          ],
        });

        // Update the status of these parallel time slots to 'available' if they were blocked by this reservation
        const bulkOps = parallelTimeSlots
          .filter(
            (slot) =>
              slot.status === "blocked" &&
              slot.blockedBy &&
              slot.blockedBy.toString() === reservationId
          )
          .map((slot) => ({
            updateOne: {
              filter: { _id: slot._id },
              update: { status: "available", isAvailable: true, blockedBy: null },
            },
          }));

        if (bulkOps.length > 0) {
          await TimeSlot.bulkWrite(bulkOps);
          console.log("Unblocked parallel time slots:", bulkOps.map((op) => op.updateOne.filter._id));
        }
      }

      // Send decline email to customer
      const emailContent =
        source === "approvedReservations"
          ? `
          <html>
            <head><title>Reservation Refusée</title></head>
            <body style="font-family: Arial, sans-serif; color: #333;">
              <h1 style="text-align: center; color: #FF5733;">Réservation Refusée en raison de Problèmes Techniques</h1>
              <p>Bonjour ${reservation.name},</p>
              <p>Nous sommes désolés de vous informer que votre réservation a été refusée en raison de problèmes techniques imprévus.</p>
              <p>Nous nous excusons pour le désagrément causé.</p>
              <p><strong>Détails de la réservation :</strong></p>
              <ul>
                <li><strong>ID de la réservation :</strong> ${reservation._id}</li>
                <li><strong>Créneau horaire :</strong> ${new Date(timeSlot.startTime).toLocaleString("fr-FR", { timeZone: "Africa/Tunis" })} - ${new Date(timeSlot.endTime).toLocaleString("fr-FR", { timeZone: "Africa/Tunis" })}</li>
                <li><strong>Statut :</strong> Refusée</li>
              </ul>
            </body>
          </html>
        `
          : `
          <html>
            <head><title>Reservation Refusée</title></head>
            <body style="font-family: Arial, sans-serif; color: #333;">
              <h1 style="text-align: center; color: #FF5733;">Réservation Refusée</h1>
              <p>Bonjour ${reservation.name},</p>
              <p>Votre réservation a été refusée.</p>
              <p>Veuillez choisir un autre créneau horaire et réessayer.</p>
              <p><strong>Détails de la réservation :</strong></p>
              <ul>
                <li><strong>ID de la réservation :</strong> ${reservation._id}</li>
                <li><strong>Créneau horaire :</strong> ${new Date(timeSlot.startTime).toLocaleString("fr-FR", { timeZone: "Africa/Tunis" })} - ${new Date(timeSlot.endTime).toLocaleString("fr-FR", { timeZone: "Africa/Tunis" })}</li>
                <li><strong>Statut :</strong> Refusée</li>
              </ul>
            </body>
          </html>
        `;
      await sendEmail(reservation.email, "Réservation Refusée", emailContent);

      // Remove the reservation from the original source
      if (source === "approvedReservations") {
        await ApprovedReservation.findByIdAndDelete(reservationId);
      } else {
        await Reservation.findByIdAndDelete(reservationId);
      }
    }

    // Send response
    res.status(200).json({ message: "Statut de la réservation mis à jour avec succès." });
  } catch (error) {
    console.error("Erreur lors de la mise à jour du statut de la réservation :", error);
    res.status(500).json({ message: "Erreur interne du serveur." });
  }
};

// Delete a reservation
exports.deleteReservation = async (req, res) => {
  const { source, reservationId } = req.params;

  if (!source || !reservationId) {
    return res
      .status(400)
      .json({ message: "Source or reservation ID is missing." });
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
    if (!timeSlot) {
      return res.status(400).json({ message: "Créneau horaire non trouvé pour cette réservation." });
    }

    // Move reservation to DeletedReservation
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

    // If time slot is in the past, additional logic can be implemented here if needed

    // Update time slot status based on reservation source
    if (source === "approvedReservations") {
      timeSlot.status = "available";
      timeSlot.isAvailable = true;
      timeSlot.blockedBy = null;
      await timeSlot.save();
    } else if (source === "reservations" || source === "declinedReservations") {
      timeSlot.status = "available";
      timeSlot.isAvailable = true;
      timeSlot.blockedBy = null;
      await timeSlot.save();
    }

    // Unblock parallel time slots if necessary
    const scenarioDoc = await Scenario.findById(reservation.scenario);
    const chapterDoc = await Chapter.findById(reservation.chapter);
    if (scenarioDoc && chapterDoc) {
      const parallelChapters = await Chapter.find({
        scenario: scenarioDoc._id,
        _id: { $ne: chapterDoc._id },
      });

      if (parallelChapters.length > 0) {
        const parallelChapterIds = parallelChapters.map((chap) => chap._id);

        const parallelTimeSlots = await TimeSlot.find({
          chapter: { $in: parallelChapterIds },
          $and: [
            { startTime: { $lt: timeSlot.endTime } },
            { endTime: { $gt: timeSlot.startTime } },
          ],
        });

        const bulkOps = parallelTimeSlots
          .filter(
            (slot) =>
              slot.status === "blocked" &&
              slot.blockedBy &&
              slot.blockedBy.toString() === reservationId
          )
          .map((slot) => ({
            updateOne: {
              filter: { _id: slot._id },
              update: { status: "available", isAvailable: true, blockedBy: null },
            },
          }));

        if (bulkOps.length > 0) {
          await TimeSlot.bulkWrite(bulkOps);
          console.log("Unblocked parallel time slots:", bulkOps.map((op) => op.updateOne.filter._id));
        }
      }
    }

    // Delete the reservation from the original source
    if (source === "reservations") {
      await Reservation.findByIdAndDelete(reservationId);
    } else if (source === "approvedReservations") {
      await ApprovedReservation.findByIdAndDelete(reservationId);
    } else if (source === "declinedReservations") {
      await DeclinedReservation.findByIdAndDelete(reservationId);
    }

    return res.status(200).json({
      message: "Reservation deleted and moved to DeletedReservation.",
    });
  } catch (error) {
    console.error("Error deleting reservation:", error);
    res.status(500).json({ message: "Internal server error." });
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

    // Validate status
    if (!["approved", "declined"].includes(status)) {
      return res.status(400).json({ message: "Statut invalide. Utilisez 'approved' ou 'declined'." });
    }

    // Fetch the reservation based on source
    let reservation;
    if (source === "reservations") {
      reservation = await Reservation.findById(reservationId).populate("timeSlot chapter");
    } else if (source === "approvedReservations") {
      reservation = await ApprovedReservation.findById(reservationId).populate("timeSlot chapter");
    } else if (source === "declinedReservations") {
      reservation = await DeclinedReservation.findById(reservationId).populate("timeSlot chapter");
    } else {
      return res.status(400).json({ message: "Source invalide spécifié." });
    }

    // Validate if reservation exists
    if (!reservation) {
      return res.status(404).json({ message: "Réservation non trouvée." });
    }

    const timeSlot = reservation.timeSlot;

    // Validate if time slot exists
    if (!timeSlot) {
      return res.status(400).json({ message: "Créneau horaire non trouvé pour cette réservation." });
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

      // **New Logic**: Block parallel time slots in other chapters of the same scenario
      const scenarioId = reservation.scenario;
      const chapterId = reservation.chapter._id;

      // Find all chapters in the same scenario excluding the current one
      const parallelChapters = await Chapter.find({
        scenario: scenarioId,
        _id: { $ne: chapterId },
      });

      if (parallelChapters.length > 0) {
        // Extract chapter IDs
        const parallelChapterIds = parallelChapters.map((chap) => chap._id);

        // Find all time slots in parallel chapters that overlap with the selected time slot
        const parallelTimeSlots = await TimeSlot.find({
          chapter: { $in: parallelChapterIds },
          $or: [
            {
              startTime: { $lte: timeSlot.startTime },
              endTime: { $gte: timeSlot.startTime },
            },
      
            {
              startTime: { $gte: timeSlot.startTime },
              endTime: { $lte: timeSlot.endTime },
            },
          ],
        });

        // Update the status of these parallel time slots to 'blocked' if they are 'available'
        const bulkOps = parallelTimeSlots
          .filter((slot) => slot.status === "available")
          .map((slot) => ({
            updateOne: {
              filter: { _id: slot._id },
              update: { status: "blocked", blockedBy: approvedReservation._id },
            },
          }));

        if (bulkOps.length > 0) {
          await TimeSlot.bulkWrite(bulkOps);
        }
      }

      // Send approval email to customer
      const emailContent = `
        <html>
          <head><title>Reservation Approved</title></head>
          <body style="font-family: Arial, sans-serif; color: #333;">
            <h1 style="text-align: center; color: #4CAF50;">Votre réservation a été approuvée</h1>
            <p>Bonjour ${reservation.name},</p>
            <p>Votre réservation a été approuvée avec succès.</p>
            <p><strong>Détails de la réservation :</strong></p>
            <ul>
              <li><strong>ID de la réservation :</strong> ${reservation._id}</li>
              <li><strong>Créneau horaire :</strong> ${new Date(timeSlot.startTime).toLocaleString()} - ${new Date(timeSlot.endTime).toLocaleString()}</li>
              <li><strong>Statut :</strong> Approuvée</li>
            </ul>
            <p>Merci d'avoir choisi notre service !</p>
          </body>
        </html>
      `;
      await sendEmail(reservation.email, "Réservation Approuvée", emailContent);

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

      // **New Logic**: Unblock parallel time slots in other chapters of the same scenario
      const scenarioId = reservation.scenario;
      const chapterId = reservation.chapter._id;

      // Find all chapters in the same scenario excluding the current one
      const parallelChapters = await Chapter.find({
        scenario: scenarioId,
        _id: { $ne: chapterId },
      });

      if (parallelChapters.length > 0) {
        // Extract chapter IDs
        const parallelChapterIds = parallelChapters.map((chap) => chap._id);

        // Find all time slots in parallel chapters that overlap with the selected time slot
        const parallelTimeSlots = await TimeSlot.find({
          chapter: { $in: parallelChapterIds },
          $or: [
            {
              startTime: { $lte: timeSlot.startTime },
              endTime: { $gte: timeSlot.startTime },
            },
        
            {
              startTime: { $gte: timeSlot.startTime },
              endTime: { $lte: timeSlot.endTime },
            },
          ],
        });

        // Update the status of these parallel time slots to 'available' if they were blocked by this reservation
        const bulkOps = parallelTimeSlots
          .filter((slot) => slot.status === "blocked" && slot.blockedBy && slot.blockedBy.toString() === reservationId)
          .map((slot) => ({
            updateOne: {
              filter: { _id: slot._id },
              update: {  status: "available", isAvailable: true, blockedBy: null },
            },
          }));

        if (bulkOps.length > 0) {
          await TimeSlot.bulkWrite(bulkOps);
        }
      }

      // Send decline email to customer
      const emailContent =
        source === "approvedReservations"
          ? `
          <html>
            <head><title>Reservation Declined</title></head>
            <body style="font-family: Arial, sans-serif; color: #333;">
              <h1 style="text-align: center; color: #FF5733;">Reservation Declined Due to Technical Issues</h1>
              <p>Bonjour ${reservation.name},</p>
              <p>Nous sommes désolés de vous informer que votre réservation a été refusée en raison de problèmes techniques imprévus.</p>
              <p>Nous nous excusons pour le désagrément causé.</p>
              <p><strong>Détails de la réservation :</strong></p>
              <ul>
                <li><strong>ID de la réservation :</strong> ${reservation._id}</li>
                <li><strong>Créneau horaire :</strong> ${new Date(timeSlot.startTime).toLocaleString()} - ${new Date(timeSlot.endTime).toLocaleString()}</li>
                <li><strong>Statut :</strong> Refusée</li>
              </ul>
            </body>
          </html>
        `
          : `
          <html>
            <head><title>Reservation Declined</title></head>
            <body style="font-family: Arial, sans-serif; color: #333;">
              <h1 style="text-align: center; color: #FF5733;">Réservation Refusée</h1>
              <p>Bonjour ${reservation.name},</p>
              <p>Votre réservation a été refusée.</p>
              <p>Veuillez choisir un autre créneau horaire et réessayer.</p>
              <p><strong>Détails de la réservation :</strong></p>
              <ul>
                <li><strong>ID de la réservation :</strong> ${reservation._id}</li>
                <li><strong>Créneau horaire :</strong> ${new Date(timeSlot.startTime).toLocaleString()} - ${new Date(timeSlot.endTime).toLocaleString()}</li>
                <li><strong>Statut :</strong> Refusée</li>
              </ul>
            </body>
          </html>
        `;
      await sendEmail(reservation.email, "Réservation Refusée", emailContent);

      // Remove the reservation from the original source
      if (source === "approvedReservations") {
        await ApprovedReservation.findByIdAndDelete(reservationId);
      } else {
        await Reservation.findByIdAndDelete(reservationId);
      }
    }

    // Send response
    res.status(200).json({ message: "Statut de la réservation mis à jour avec succès." });
  } catch (error) {
    console.error("Erreur lors de la mise à jour du statut de la réservation :", error);
    res.status(500).json({ message: "Erreur interne du serveur." });
  }
};

exports.deleteReservation = async (req, res) => {
  const { source, reservationId } = req.params;

  if (!source || !reservationId) {
    return res
      .status(400)
      .json({ message: "Source or reservation ID is missing." });
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

      return res
        .status(200)
        .json({
          message: "Reservation deleted and moved to DeletedReservation.",
        });
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

      return res
        .status(200)
        .json({
          message: "Reservation deleted and moved to DeletedReservation.",
        });
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
      .populate("scenario")
      .populate("chapter")
      .populate("timeSlot");
    if (!reservation) {
      return res.status(404).json({ message: "Reservation not found" });
    }
    res.status(200).json(reservation);
  } catch (error) {
    console.error("Error fetching reservation:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
