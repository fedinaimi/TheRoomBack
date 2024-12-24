

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
exports.createReservation = async (req, res) => { // Correction ici: remplacer 're*s' par 'res'
  try {
    console.log("Début de la création de réservation");
    const { scenario, chapter, timeSlot, name, email, phone, language, people } = req.body;

    // Validation des champs obligatoires
    if (!scenario || !chapter || !timeSlot || !name || !email || !phone || !people) {
      console.warn("Champs manquants:", req.body);
      return res.status(400).json({
        message: "Tous les champs sont obligatoires : scénario, chapitre, créneau horaire, nom, email, téléphone et nombre de personnes.",
      });
    }

    if (people <= 0) {
      console.warn("Nombre de personnes invalide:", people);
      return res.status(400).json({
        message: "Le nombre de personnes doit être supérieur à zéro.",
      });
    }

    // Vérifier si le créneau horaire existe
    const timeSlotData = await TimeSlot.findById(timeSlot);
    if (!timeSlotData) {
      console.warn("Créneau horaire non trouvé:", timeSlot);
      return res.status(404).json({ message: "Le créneau horaire n'existe pas." });
    }

    // Vérifier si le créneau horaire est disponible
    if (timeSlotData.status !== "available") {
      console.warn("Créneau horaire indisponible:", timeSlot);
      return res.status(400).json({ message: "Le créneau horaire est déjà réservé ou indisponible." });
    }

    // Récupérer les détails du scénario et du chapitre
    const scenarioDoc = await Scenario.findById(scenario);
    if (!scenarioDoc) {
      console.warn("Scénario introuvable:", scenario);
      return res.status(404).json({ message: "Scénario introuvable." });
    }

    const chapterDoc = await Chapter.findById(chapter);
    if (!chapterDoc) {
      console.warn("Chapitre introuvable:", chapter);
      return res.status(404).json({ message: "Chapitre introuvable." });
    }

    const scenarioName = scenarioDoc.name || `Scénario (ID: ${scenario})`;
    const chapterName = chapterDoc.name || `Chapitre (ID: ${chapter})`;

    // Déterminer le jour basé sur le créneau horaire sélectionné
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

    // Récupérer les réservations de l'utilisateur (approuvées et en attente) filtrées par le même jour
    const userApprovedReservations = await ApprovedReservation.find({ email, phone }).populate("timeSlot");
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

    console.log("Réservations approuvées aujourd'hui:", approvedReservationsThisDay.length);
    console.log("Réservations en attente aujourd'hui:", pendingReservationsThisDay.length);

    // Vérifier si l'utilisateur a déjà réservé ce scénario et chapitre le même jour
    const sameScenarioChapterReservation = allReservationsThisDay.find(
      (resv) =>
        resv.scenario.toString() === scenario.toString() &&
        resv.chapter.toString() === chapter.toString()
    );

    if (sameScenarioChapterReservation) {
      console.warn("Réservation du même scénario et chapitre déjà existante pour aujourd'hui.");
      return res.status(400).json({
        message: "Vous avez déjà réservé un créneau pour ce scénario et ce chapitre aujourd'hui.",
      });
    }

    // Limiter à 3 réservations totales par utilisateur par jour
    if (allReservationsThisDay.length >= 3) {
      console.warn("Limite de réservations quotidienne atteinte:", allReservationsThisDay.length);
      return res.status(400).json({
        message: "Vous ne pouvez effectuer qu'un maximum de 3 réservations par jour.",
      });
    }

    // Créer une nouvelle réservation
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
    console.log("Réservation créée:", reservation._id);

    // Mettre à jour le statut du créneau horaire en "pending"
    timeSlotData.status = "pending";
    await timeSlotData.save();
    console.log("Statut du créneau horaire mis à jour en 'pending'");

    // Bloquer uniquement les créneaux parallèles dans d'autres chapitres du même scénario
    const parallelChapters = await Chapter.find({
      scenario: scenarioDoc._id,
      _id: { $ne: chapterDoc._id },
    });

    if (parallelChapters.length > 0) {
      const parallelChapterIds = parallelChapters.map((chap) => chap._id);

      const parallelTimeSlots = await TimeSlot.find({
        chapter: { $in: parallelChapterIds },
        startTime: { $lt: timeSlotData.endTime }, // Surcharge avec endTime
        endTime: { $gt: timeSlotData.startTime }, // Surcharge avec startTime
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
        console.log("Créneaux parallèles bloqués:", bulkOps.map((op) => op.updateOne.filter._id));
      }
    }

    // Formater les heures pour les emails
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

    // Email de confirmation au client
    const customerEmailSubject = "Restez informé : Votre réservation est en attente d'approbation";
    const customerEmailContent = `
      <html>
      <head>
      <title>Confirmation est en cours de traitement</title>
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
            <h1>Confirmation est en cours de traitement</h1>
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
            &copy; ${new Date().getFullYear()} The ROOM - Tous droits réservés.
          </div>
        </div>
      </body>
      </html>
    `;

    await sendEmail(email, customerEmailSubject, customerEmailContent);
    console.log("Email de confirmation envoyé au client:", email);

    // Notification aux administrateurs
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
            &copy; ${new Date().getFullYear()} The ROOM - Tous droits réservés.
          </div>
        </div>
      </body>
      </html>
    `;

    for (const adminUser of admins) {
      await sendEmail(adminUser.email, adminEmailSubject, adminEmailContent);
      console.log("Email envoyé à l'administrateur:", adminUser.email);
    }

    // Créer une notification pour l'utilisateur
    const notification = new Notification({
      message: "Nouvelle réservation en attente d'approbation.",
      reservationId: reservation._id,
      details: {
        name,
        email,
        phone,
        people,
        scenario: scenarioName,
        chapter: chapterName,
        timeSlot: {
          startTime: timeSlotData.startTime,
          endTime: timeSlotData.endTime,
        },
      },
    });
    await notification.save();
    console.log("Notification créée pour l'utilisateur:", notification._id);

    // Émettre la notification via Socket.IO
    if (global.io) {
      global.io.emit("notification", notification);
      console.log("Notification émise via Socket.IO");
    } else {
      console.warn("Socket.IO n'est pas initialisé.");
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
      console.warn(`Invalid status: ${status}`);
      return res.status(400).json({
        message: "Statut invalide. Utilisez 'approved' ou 'declined'.",
      });
    }

    // Determine the correct Reservation model based on source
    let ReservationModel;
    if (source === "reservations") {
      ReservationModel = Reservation;
    } else if (source === "approvedReservations") {
      ReservationModel = ApprovedReservation;
    } else if (source === "declinedReservations") {
      ReservationModel = DeclinedReservation;
    } else {
      console.warn(`Invalid source specified: ${source}`);
      return res.status(400).json({ message: "Source invalide spécifié." });
    }

    // Fetch the reservation based on source
    const reservation = await ReservationModel.findById(reservationId)
      .populate("timeSlot chapter scenario")
      .exec();

    // Validate if reservation exists
    if (!reservation) {
      console.warn(`Reservation not found: ID ${reservationId}`);
      return res.status(404).json({ message: "Réservation non trouvée." });
    }

    const timeSlot = reservation.timeSlot;

    // Validate if time slot exists
    if (!timeSlot) {
      console.warn(`Time slot not found for reservation: ID ${reservationId}`);
      return res.status(400).json({
        message: "Créneau horaire non trouvé pour cette réservation.",
      });
    }

    // Fetch related Scenario and Chapter documents
    const scenarioDoc = await Scenario.findById(reservation.scenario).exec();
    const chapterDoc = await Chapter.findById(reservation.chapter).exec();

    if (!scenarioDoc || !chapterDoc) {
      console.warn(`Scenario or Chapter not found for reservation: ID ${reservationId}`);
      return res.status(404).json({ message: "Scénario ou Chapitre introuvable." });
    }

    if (status === "approved") {
      // Move to ApprovedReservation collection
      const approvedReservation = new ApprovedReservation({
        ...reservation.toObject(),
        status: "approved",
      });
      await approvedReservation.save();
      console.log(`Reservation approved and moved: ID ${approvedReservation._id}`);

      // Update time slot to "booked"
      timeSlot.status = "booked";
      timeSlot.isAvailable = false;
      await timeSlot.save();
      console.log(`Time slot updated to 'booked': ID ${timeSlot._id}`);

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
          startTime: { $lt: timeSlot.endTime }, // Overlaps with current time slot's end
          endTime: { $gt: timeSlot.startTime }, // Overlaps with current time slot's start
          status: "available", // Only available slots can be blocked
        });

        // Update the status of these parallel time slots to 'blocked'
        const bulkOps = parallelTimeSlots.map((slot) => ({
          updateOne: {
            filter: { _id: slot._id },
            update: {
              status: "blocked",
              blockedBy: approvedReservation._id,
              isAvailable: false,
            },
          },
        }));

        if (bulkOps.length > 0) {
          await TimeSlot.bulkWrite(bulkOps);
          console.log(
            "Blocked parallel time slots:",
            bulkOps.map((op) => op.updateOne.filter._id)
          );
        }
      }

      // Send approval email to customer
      const approvalEmailContent = `
        <html>
          <head>
            <title>Réservation Approuvée</title>
            <meta charset="UTF-8"/>
            <style>
              body { font-family: Arial, sans-serif; background:#f5f5f5; margin:0; padding:0; color:#333; }
              .email-container { max-width:600px; margin:30px auto; background:#ffffff; border-radius:8px; overflow:hidden; border:1px solid #ddd; }
              .header { background:#4CAF50; color:#ffffff; padding:20px; text-align:center; }
              .header h1 { margin:0; font-size:24px; }
              .content { padding:20px; }
              .content h2 { margin-top:0; }
              .details p { margin:5px 0; }
              .footer { background:#f0f0f0; padding:10px; text-align:center; font-size:14px; color:#666; }
            </style>
          </head>
          <body>
            <div class="email-container">
              <div class="header">
                <h1>Votre réservation a été approuvée</h1>
              </div>
              <div class="content">
                <h2>Bonjour ${reservation.name},</h2>
                <p>Votre réservation a été approuvée avec succès. Voici les détails :</p>
                <div class="details">
                  <p><strong>ID de la réservation :</strong> ${reservation._id}</p>
                  <p><strong>Créneau horaire :</strong> ${new Date(timeSlot.startTime).toLocaleString("fr-FR", {
                    timeZone: "Africa/Tunis",
                    hour12: false,
                  })} - ${new Date(timeSlot.endTime).toLocaleString("fr-FR", {
                    timeZone: "Africa/Tunis",
                    hour12: false,
                  })}</p>
                  <p><strong>Statut :</strong> Approuvée</p>
                </div>
                <p>Merci d'avoir choisi notre service !</p>
                <p>Après avoir joué, partagez votre expérience et laissez votre avis sur notre page Google Maps : <a href="https://www.google.com/maps/place/The+Room+Escape+Game/@36.8536969,10.1663538,17z/data=!3m1!4b1!4m6!3m5!1s0x12fd33563fb1afad:0xd1e0353f2a6e4df9!8m2!3d36.8536969!4d10.1689287!16s%2Fg%2F11f57szbtq?entry=tts&g_ep=EgoyMDI0MTIxMS4wIPu8ASoASAFQAw%3D%3D" target="_blank">The Room Escape Game</a>.</p>
              </div>
              <div class="footer">
                &copy; ${new Date().getFullYear()} The ROOM - Tous droits réservés.
              </div>
            </div>
          </body>
        </html>
      `;
      await sendEmail(reservation.email, "Réservation Approuvée", approvalEmailContent);
      console.log(`Approval email sent to customer: ${reservation.email}`);

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
      console.log(`Reservation declined and moved: ID ${declinedReservation._id}`);

      // Update time slot to "available"
      timeSlot.status = "available";
      timeSlot.isAvailable = true;
      await timeSlot.save();
      console.log(`Time slot updated to 'available': ID ${timeSlot._id}`);

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
          startTime: { $lt: timeSlot.endTime }, // Overlaps with current time slot's end
          endTime: { $gt: timeSlot.startTime }, // Overlaps with current time slot's start
          status: "blocked",
          blockedBy: reservationId, // Ensure only slots blocked by this reservation are unblocked
        });

        // Update the status of these parallel time slots to 'available'
        const bulkOps = parallelTimeSlots.map((slot) => ({
          updateOne: {
            filter: { _id: slot._id },
            update: {
              status: "available",
              isAvailable: true,
              blockedBy: null,
            },
          },
        }));

        if (bulkOps.length > 0) {
          await TimeSlot.bulkWrite(bulkOps);
          console.log(
            "Unblocked parallel time slots:",
            bulkOps.map((op) => op.updateOne.filter._id)
          );
        }
      }

      // Send decline email to customer
      const declineEmailContent =
        source === "approvedReservations"
          ? `
          <html>
            <head>
              <title>Réservation Refusée</title>
              <meta charset="UTF-8"/>
              <style>
                body { font-family: Arial, sans-serif; color: #333; background:#f5f5f5; margin:0; padding:0; }
                .email-container { max-width:600px; margin:30px auto; background:#ffffff; border-radius:8px; overflow:hidden; border:1px solid #ddd; }
                .header { background:#FF5733; color:#ffffff; padding:20px; text-align:center; }
                .header h1 { margin:0; font-size:24px; }
                .content { padding:20px; }
                .content h2 { margin-top:0; }
                .details p { margin:5px 0; }
                .footer { background:#f0f0f0; padding:10px; text-align:center; font-size:14px; color:#666; }
              </style>
            </head>
            <body>
              <div class="email-container">
                <div class="header">
                  <h1>Réservation Refusée</h1>
                </div>
                <div class="content">
                  <h2>Bonjour ${reservation.name},</h2>
                  <p>Nous sommes désolés de vous informer que votre réservation a été refusée en raison de problèmes techniques imprévus.</p>
                  <div class="details">
                    <p><strong>ID de la réservation :</strong> ${reservation._id}</p>
                    <p><strong>Créneau horaire :</strong> ${new Date(timeSlot.startTime).toLocaleString("fr-FR", {
                      timeZone: "Africa/Tunis",
                      hour12: false,
                    })} - ${new Date(timeSlot.endTime).toLocaleString("fr-FR", {
                      timeZone: "Africa/Tunis",
                      hour12: false,
                    })}</p>
                    <p><strong>Statut :</strong> Refusée</p>
                  </div>
                  <p>Nous nous excusons pour le désagrément causé.</p>
                </div>
                <div class="footer">
                  &copy; ${new Date().getFullYear()} The ROOM - Tous droits réservés.
                </div>
              </div>
            </body>
          </html>
        `
          : `
          <html>
            <head>
              <title>Réservation Refusée</title>
              <meta charset="UTF-8"/>
              <style>
                body { font-family: Arial, sans-serif; color: #333; background:#f5f5f5; margin:0; padding:0; }
                .email-container { max-width:600px; margin:30px auto; background:#ffffff; border-radius:8px; overflow:hidden; border:1px solid #ddd; }
                .header { background:#FF5733; color:#ffffff; padding:20px; text-align:center; }
                .header h1 { margin:0; font-size:24px; }
                .content { padding:20px; }
                .content h2 { margin-top:0; }
                .details p { margin:5px 0; }
                .footer { background:#f0f0f0; padding:10px; text-align:center; font-size:14px; color:#666; }
              </style>
            </head>
            <body>
              <div class="email-container">
                <div class="header">
                  <h1>Réservation Refusée</h1>
                </div>
                <div class="content">
                  <h2>Bonjour ${reservation.name},</h2>
                  <p>Votre réservation a été refusée.</p>
                  <p>Veuillez choisir un autre créneau horaire et réessayer.</p>
                  <div class="details">
                    <p><strong>ID de la réservation :</strong> ${reservation._id}</p>
                    <p><strong>Créneau horaire :</strong> ${new Date(timeSlot.startTime).toLocaleString("fr-FR", {
                      timeZone: "Africa/Tunis",
                      hour12: false,
                    })} - ${new Date(timeSlot.endTime).toLocaleString("fr-FR", {
                      timeZone: "Africa/Tunis",
                      hour12: false,
                    })}</p>
                    <p><strong>Statut :</strong> Refusée</p>
                  </div>
                </div>
                <div class="footer">
                  &copy; ${new Date().getFullYear()} The ROOM - Tous droits réservés.
                </div>
              </div>
            </body>
          </html>
        `;
      await sendEmail(reservation.email, "Réservation Refusée", emailContent);
      console.log(`Decline email sent to customer: ${reservation.email}`);

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
      return res
        .status(400)
        .json({
          message: "Créneau horaire non trouvé pour cette réservation.",
        });
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
              update: {
                status: "available",
                isAvailable: true,
                blockedBy: null,
              },
            },
          }));

        if (bulkOps.length > 0) {
          await TimeSlot.bulkWrite(bulkOps);
          console.log(
            "Unblocked parallel time slots:",
            bulkOps.map((op) => op.updateOne.filter._id)
          );
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

// src/controllers/reservationController.js



// Update reservation status (approve or decline)
exports.updateReservationStatus = async (req, res) => {
  try {
    const { status } = req.body; // 'approved' or 'declined'
    const { source, reservationId } = req.params; // Source and ID of the reservation

    // Validate status
    if (!["approved", "declined"].includes(status)) {
      console.warn(`Invalid status: ${status}`);
      return res.status(400).json({
        message: "Statut invalide. Utilisez 'approved' ou 'declined'.",
      });
    }

    // Determine the correct Reservation model based on source
    let ReservationModel;
    if (source === "reservations") {
      ReservationModel = Reservation;
    } else if (source === "approvedReservations") {
      ReservationModel = ApprovedReservation;
    } else if (source === "declinedReservations") {
      ReservationModel = DeclinedReservation;
    } else {
      console.warn(`Invalid source specified: ${source}`);
      return res.status(400).json({ message: "Source invalide spécifié." });
    }

    // Fetch the reservation based on source
    const reservation = await ReservationModel.findById(reservationId)
      .populate("timeSlot chapter scenario")
      .exec();

    // Validate if reservation exists
    if (!reservation) {
      console.warn(`Reservation not found: ID ${reservationId}`);
      return res.status(404).json({ message: "Réservation non trouvée." });
    }

    const timeSlot = reservation.timeSlot;

    // Validate if time slot exists
    if (!timeSlot) {
      console.warn(`Time slot not found for reservation: ID ${reservationId}`);
      return res.status(400).json({
        message: "Créneau horaire non trouvé pour cette réservation.",
      });
    }

    // Fetch related Scenario and Chapter documents
    const scenarioDoc = await Scenario.findById(reservation.scenario).exec();
    const chapterDoc = await Chapter.findById(reservation.chapter).exec();

    if (!scenarioDoc || !chapterDoc) {
      console.warn(`Scenario or Chapter not found for reservation: ID ${reservationId}`);
      return res.status(404).json({ message: "Scénario ou Chapitre introuvable." });
    }

    if (status === "approved") {
      // Move to ApprovedReservation collection
      const approvedReservation = new ApprovedReservation({
        ...reservation.toObject(),
        status: "approved",
      });
      await approvedReservation.save();
      console.log(`Reservation approved and moved: ID ${approvedReservation._id}`);

      // Update time slot to "booked"
      timeSlot.status = "booked";
      timeSlot.isAvailable = false;
      await timeSlot.save();
      console.log(`Time slot updated to 'booked': ID ${timeSlot._id}`);

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
          startTime: { $lt: timeSlot.endTime }, // Overlaps with current time slot's end
          endTime: { $gt: timeSlot.startTime }, // Overlaps with current time slot's start
          status: "available", // Only available slots can be blocked
        });

        // Update the status of these parallel time slots to 'blocked'
        const bulkOps = parallelTimeSlots.map((slot) => ({
          updateOne: {
            filter: { _id: slot._id },
            update: {
              status: "blocked",
              blockedBy: approvedReservation._id,
              isAvailable: false,
            },
          },
        }));

        if (bulkOps.length > 0) {
          await TimeSlot.bulkWrite(bulkOps);
          console.log(
            "Blocked parallel time slots:",
            bulkOps.map((op) => op.updateOne.filter._id)
          );
        }
      }

      // Send approval email to customer
      const approvalEmailContent = generateApprovalEmailContent(reservation, timeSlot, scenarioDoc, chapterDoc);
      await sendEmail(reservation.email, "Réservation Approuvée", approvalEmailContent);
      console.log(`Approval email sent to customer: ${reservation.email}`);

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
      console.log(`Reservation declined and moved: ID ${declinedReservation._id}`);

      // Update time slot to "available"
      timeSlot.status = "available";
      timeSlot.isAvailable = true;
      await timeSlot.save();
      console.log(`Time slot updated to 'available': ID ${timeSlot._id}`);

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
          startTime: { $lt: timeSlot.endTime }, // Overlaps with current time slot's end
          endTime: { $gt: timeSlot.startTime }, // Overlaps with current time slot's start
          status: "blocked",
          blockedBy: reservationId, // Ensure only slots blocked by this reservation are unblocked
        });

        // Update the status of these parallel time slots to 'available'
        const bulkOps = parallelTimeSlots.map((slot) => ({
          updateOne: {
            filter: { _id: slot._id },
            update: {
              status: "available",
              isAvailable: true,
              blockedBy: null,
            },
          },
        }));

        if (bulkOps.length > 0) {
          await TimeSlot.bulkWrite(bulkOps);
          console.log(
            "Unblocked parallel time slots:",
            bulkOps.map((op) => op.updateOne.filter._id)
          );
        }
      }

      // Send decline email to customer
      const declineEmailContent = generateDeclineEmailContent(reservation, timeSlot, scenarioDoc, chapterDoc, source);
      await sendEmail(reservation.email, "Réservation Refusée", declineEmailContent);
      console.log(`Decline email sent to customer: ${reservation.email}`);

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

// Helper function to generate approval email content (matches createReservation template)
const generateApprovalEmailContent = (reservation, timeSlot, scenarioDoc, chapterDoc) => {
  const startTimeLocal = new Date(timeSlot.startTime).toLocaleString("fr-FR", {
    timeZone: "Africa/Tunis",
    hour12: false,
  });
  const endTimeLocal = new Date(timeSlot.endTime).toLocaleString("fr-FR", {
    timeZone: "Africa/Tunis",
    hour12: false,
  });

  return `
    <html>
      <head>
        <title>Réservation Approuvée</title>
        <meta charset="UTF-8"/>
        <style>
          body { font-family: Arial, sans-serif; background:#f5f5f5; margin:0; padding:0; color:#333; }
          .email-container { max-width:600px; margin:30px auto; background:#ffffff; border-radius:8px; overflow:hidden; border:1px solid #ddd; }
          .header { background:#4CAF50; color:#ffffff; padding:20px; text-align:center; }
          .header h1 { margin:0; font-size:24px; }
          .content { padding:20px; }
          .content h2 { margin-top:0; }
          .details p { margin:5px 0; }
          .footer { background:#f0f0f0; padding:10px; text-align:center; font-size:14px; color:#666; }
        </style>
      </head>
      <body>
        <div class="email-container">
          <div class="header">
            <h1>Votre réservation a été approuvée</h1>
          </div>
          <div class="content">
            <h2>Bonjour ${reservation.name},</h2>
            <p>Nous sommes heureux de vous informer que votre réservation a été approuvée avec succès. Voici les détails :</p>
            <div class="details">
              <p><strong>ID de la réservation :</strong> ${reservation._id}</p>
              <p><strong>Créneau horaire :</strong> Du ${startTimeLocal} au ${endTimeLocal}</p>
              <p><strong>Statut :</strong> Approuvée</p>
              <p><strong>Scénario :</strong> ${scenarioDoc.name}</p>
              <p><strong>Chapitre :</strong> ${chapterDoc.name}</p>
              <p><strong>Nombre de personnes :</strong> ${reservation.people}</p>
            </div>
            <p>Merci d'avoir choisi notre service !</p>
          </div>
          <div class="footer">
            &copy; ${new Date().getFullYear()} The ROOM - Tous droits réservés.
          </div>
        </div>
      </body>
    </html>
  `;
};

// Helper function to generate decline email content (matches createReservation template)
const generateDeclineEmailContent = (reservation, timeSlot, scenarioDoc, chapterDoc, source) => {
  const startTimeLocal = new Date(timeSlot.startTime).toLocaleString("fr-FR", {
    timeZone: "Africa/Tunis",
    hour12: false,
  });
  const endTimeLocal = new Date(timeSlot.endTime).toLocaleString("fr-FR", {
    timeZone: "Africa/Tunis",
    hour12: false,
  });

  let subject = "Réservation Refusée";
  let content = "";

  if (source === "approvedReservations") {
    subject = "Réservation Refusée en raison de Problèmes Techniques";
    content = `
      <html>
        <head>
          <title>Réservation Refusée</title>
          <meta charset="UTF-8"/>
          <style>
            body { font-family: Arial, sans-serif; background:#f5f5f5; margin:0; padding:0; color:#333; }
            .email-container { max-width:600px; margin:30px auto; background:#ffffff; border-radius:8px; overflow:hidden; border:1px solid #ddd; }
            .header { background:#FF5733; color:#ffffff; padding:20px; text-align:center; }
            .header h1 { margin:0; font-size:24px; }
            .content { padding:20px; }
            .content h2 { margin-top:0; }
            .details p { margin:5px 0; }
            .footer { background:#f0f0f0; padding:10px; text-align:center; font-size:14px; color:#666; }
          </style>
        </head>
        <body>
          <div class="email-container">
            <div class="header">
              <h1>Réservation Refusée</h1>
            </div>
            <div class="content">
              <h2>Bonjour ${reservation.name},</h2>
              <p>Nous sommes désolés de vous informer que votre réservation a été refusée en raison de problèmes techniques imprévus.</p>
              <div class="details">
                <p><strong>ID de la réservation :</strong> ${reservation._id}</p>
                <p><strong>Créneau horaire :</strong> Du ${startTimeLocal} au ${endTimeLocal}</p>
                <p><strong>Statut :</strong> Refusée</p>
                <p><strong>Scénario :</strong> ${scenarioDoc.name}</p>
                <p><strong>Chapitre :</strong> ${chapterDoc.name}</p>
                <p><strong>Nombre de personnes :</strong> ${reservation.people}</p>
              </div>
              <p>Nous nous excusons pour le désagrément causé.</p>
            </div>
            <div class="footer">
              &copy; ${new Date().getFullYear()} The ROOM - Tous droits réservés.
            </div>
          </div>
        </body>
      </html>
    `;
  } else {
    content = `
      <html>
        <head>
          <title>Réservation Refusée</title>
          <meta charset="UTF-8"/>
          <style>
            body { font-family: Arial, sans-serif; background:#f5f5f5; margin:0; padding:0; color:#333; }
            .email-container { max-width:600px; margin:30px auto; background:#ffffff; border-radius:8px; overflow:hidden; border:1px solid #ddd; }
            .header { background:#FF5733; color:#ffffff; padding:20px; text-align:center; }
            .header h1 { margin:0; font-size:24px; }
            .content { padding:20px; }
            .content h2 { margin-top:0; }
            .details p { margin:5px 0; }
            .footer { background:#f0f0f0; padding:10px; text-align:center; font-size:14px; color:#666; }
          </style>
        </head>
        <body>
          <div class="email-container">
            <div class="header">
              <h1>Réservation Refusée</h1>
            </div>
            <div class="content">
              <h2>Bonjour ${reservation.name},</h2>
              <p>Votre réservation a été refusée.</p>
              <p>Veuillez choisir un autre créneau horaire et réessayer.</p>
              <div class="details">
                <p><strong>ID de la réservation :</strong> ${reservation._id}</p>
                <p><strong>Créneau horaire :</strong> Du ${startTimeLocal} au ${endTimeLocal}</p>
                <p><strong>Statut :</strong> Refusée</p>
                <p><strong>Scénario :</strong> ${scenarioDoc.name}</p>
                <p><strong>Chapitre :</strong> ${chapterDoc.name}</p>
                <p><strong>Nombre de personnes :</strong> ${reservation.people}</p>
              </div>
            </div>
            <div class="footer">
              &copy; ${new Date().getFullYear()} The ROOM - Tous droits réservés.
            </div>
          </div>
        </body>
      </html>
    `;
  }

  return content;
};


// Delete a reservation
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

    // Check if the associated time slot exists
    const timeSlot = await TimeSlot.findById(reservation.timeSlot);
    if (!timeSlot) {
      return res.status(400).json({
        message: "Créneau horaire non trouvé pour cette réservation.",
      });
    }

    // Move reservation to DeletedReservation
    const deletedReservation = new DeletedReservation({
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
    await deletedReservation.save();
    console.log("Reservation moved to DeletedReservation:", deletedReservation._id);

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

        // Determine the correct identifier for blockedBy based on the source
        let blockedById = reservationId; // Default for 'reservations' and 'declinedReservations'

        if (source === "approvedReservations") {
          blockedById = reservationId; // For 'approvedReservations', blockedBy was set to ApprovedReservation._id
        }

        const bulkOps = parallelTimeSlots
          .filter(
            (slot) =>
              slot.status === "blocked" &&
              slot.blockedBy &&
              slot.blockedBy.toString() === blockedById
          )
          .map((slot) => ({
            updateOne: {
              filter: { _id: slot._id },
              update: {
                status: "available",
                isAvailable: true,
                blockedBy: null,
              },
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
      message: "Réservation supprimée et déplacée vers DeletedReservation.",
    });
  } catch (error) {
    console.error("Erreur lors de la suppression de la réservation :", error);
    res.status(500).json({ message: "Erreur interne du serveur." });
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
