const Reservation = require('../models/Reservation');
const TimeSlot = require('../models/TimeSlot');
const sendEmail = require('../utils/sendEmail');
const Notification = require('../models/Notifications');
const ApprovedReservation = require("../models/ApprovedReservation");
const DeclinedReservation = require("../models/DeclinedReservation");
const Scenario = require('../models/Scenario');
const Chapter = require('../models/Chapter');
const User = require('../models/User'); // Ensure User is imported for admin notification emails

exports.createReservation = async (req, res) => {
  try {
    const { scenario: scenarioId, chapter: chapterId, timeSlot: timeSlotId, name, email, phone, language } = req.body;

    // Validate required fields
    if (!scenarioId || !chapterId || !timeSlotId || !name || !email || !phone) {
      return res.status(400).json({
        message: "Tous les champs sont obligatoires : scénario, chapitre, créneau horaire, nom, email et téléphone.",
      });
    }

    // Fetch Scenario and Chapter documents
    const scenarioDoc = await Scenario.findById(scenarioId);
    if (!scenarioDoc) {
      return res.status(400).json({ message: "Scénario introuvable." });
    }

    const chapterDoc = await Chapter.findById(chapterId);
    if (!chapterDoc) {
      return res.status(400).json({ message: "Chapitre introuvable." });
    }

    const scenarioName = scenarioDoc.name || scenarioDoc.title || "Scénario";
    const chapterName = chapterDoc.name || chapterDoc.title || "Chapitre";

    // Check if the time slot exists and is available
    const timeSlotData = await TimeSlot.findById(timeSlotId);
    if (!timeSlotData || timeSlotData.status !== "available") {
      return res.status(400).json({ message: "Le créneau horaire est déjà réservé ou indisponible." });
    }

    // Define today's start and end times
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    // Fetch today's reservations (approved or pending) for this user
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

    // 1. Check if the user already reserved this scenario today (any chapter)
    const sameScenarioReservation = allReservationsToday.find(
      (resv) => resv.scenario.toString() === scenarioId.toString()
    );

    if (sameScenarioReservation) {
      return res.status(400).json({
        message: "Vous avez déjà réservé ce scénario aujourd'hui (une seule réservation par scénario et par jour).",
      });
    }

    // 2. Limit to 3 total reservations per day
    if (allReservationsToday.length >= 3) {
      return res.status(400).json({
        message: "Vous ne pouvez effectuer qu'un maximum de 3 réservations par jour.",
      });
    }

    // 3. Check if the user is trying to reserve another chapter of the same scenario for the same time slot
    const sameScenarioSameTimeSlot = allReservationsToday.find(
      (resv) =>
        resv.scenario.toString() === scenarioId.toString() &&
        resv.timeSlot.toString() === timeSlotId.toString()
    );

    if (sameScenarioSameTimeSlot) {
      return res.status(400).json({
        message: "Vous ne pouvez pas réserver un autre chapitre du même scénario sur le même créneau horaire.",
      });
    }

    // Create a new reservation
    const reservation = new Reservation({
      scenario: scenarioId,
      chapter: chapterId,
      timeSlot: timeSlotId,
      name,
      email,
      phone,
      language,
    });
    await reservation.save();

    // Update time slot status
    timeSlotData.status = "pending";
    await timeSlotData.save();

    // Create a Notification
    const notification = new Notification({
      message: `Nouvelle réservation par ${name}`,
      reservationId: reservation._id,
      details: `Réservation pour le scénario : ${scenarioName}, chapitre : ${chapterName}.`,
    });
    await notification.save();

    // Format times with Tunisian local time
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

    // Emails
    const customerEmailSubject = "Restez informé : Votre réservation est en attente d'approbation";
    const customerEmailContent = `
      <html>
      <head>
      <title>Confirmation de Réservation</title>
      <meta charset="UTF-8" />
      <style>
        body {
          font-family: Arial, sans-serif;
          background: #f5f5f5;
          color: #333;
          margin: 0;
          padding: 0;
        }
        .email-container {
          max-width: 600px;
          margin: 30px auto;
          background: #ffffff;
          border-radius: 8px;
          overflow: hidden;
          border: 1px solid #ddd;
        }
        .header {
          background: #4a90e2;
          color: #ffffff;
          padding: 20px;
          text-align: center;
        }
        .header h1 {
          margin: 0;
          font-size: 24px;
          font-weight: normal;
        }
        .content {
          padding: 20px;
        }
        .content h2 {
          margin-top: 0;
          color: #333;
        }
        .details p {
          margin: 5px 0;
        }
        .footer {
          background: #f0f0f0;
          padding: 10px;
          text-align: center;
          font-size: 14px;
          color: #666;
        }
        .highlight {
          color: red;
          font-weight: bold;
        }
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
              <p><strong>Scénario :</strong> ${scenarioName}</p>
              <p><strong>Chapitre :</strong> ${chapterName}</p>
              <p><strong>Créneau horaire :</strong> Du ${startTimeLocal} au ${endTimeLocal}</p>
            </div>
            <p class="highlight">Veuillez patienter, un administrateur doit approuver votre réservation.</p>
            <p>Nous vous tiendrons informé dès que la décision sera prise.</p>
            <p>Merci de votre confiance,</p>
            <p>L'équipe de Réservation</p>
          </div>
          <div class="footer">
            &copy; ${new Date().getFullYear()} ELEPZ'IA - Tous droits réservés.
          </div>
        </div>
      </body>
      </html>
    `;
    await sendEmail(email, customerEmailSubject, customerEmailContent);

    // Send email to admins and subadmins
    const admins = await User.find({ usertype: { $in: ["admin", "subadmin"] } });
    const adminEmailSubject = "Nouvelle réservation en attente d'approbation";
    const adminEmailContent = `
      <html>
      <head>
      <title>Nouvelle Réservation</title>
      <meta charset="UTF-8" />
      <style>
        body {
          font-family: Arial, sans-serif;
          background: #f5f5f5;
          color: #333;
          margin: 0;
          padding: 0;
        }
        .email-container {
          max-width: 600px;
          margin: 30px auto;
          background: #ffffff;
          border-radius: 8px;
          overflow: hidden;
          border: 1px solid #ddd;
        }
        .header {
          background: #d9534f;
          color: #ffffff;
          padding: 20px;
          text-align: center;
        }
        .header h1 {
          margin: 0;
          font-size: 22px;
          font-weight: normal;
        }
        .content {
          padding: 20px;
        }
        .content h2 {
          margin-top: 0;
          color: #333;
        }
        .details p {
          margin: 5px 0;
        }
        .footer {
          background: #f0f0f0;
          padding: 10px;
          text-align: center;
          font-size: 14px;
          color: #666;
        }
        .highlight {
          color: red;
          font-weight: bold;
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
              <p><strong>Scénario :</strong> ${scenarioName}</p>
              <p><strong>Chapitre :</strong> ${chapterName}</p>
              <p><strong>Créneau horaire :</strong> Du ${startTimeLocal} au ${endTimeLocal}</p>
            </div>
            <p class="highlight">Veuillez vous connecter à votre tableau de bord d'administration pour approuver ou rejeter cette réservation.</p>
            <p>Merci,</p>
            <p>L'équipe de Réservation</p>
          </div>
          <div class="footer">
            &copy; ${new Date().getFullYear()} ELEPZ'IA- Tous droits réservés.
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
    return res.status(500).json({ message: "Erreur interne du serveur. Veuillez réessayer plus tard." });
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

    let reservation;
    if (source === "reservations") {
      reservation = await Reservation.findById(reservationId)
        .populate("timeSlot")
        .populate("scenario")
        .populate("chapter");
    } else if (source === "approvedReservations") {
      reservation = await ApprovedReservation.findById(reservationId)
        .populate("timeSlot")
        .populate("scenario")
        .populate("chapter");
    } else if (source === "declinedReservations") {
      reservation = await DeclinedReservation.findById(reservationId)
        .populate("timeSlot")
        .populate("scenario")
        .populate("chapter");
    } else {
      return res.status(400).json({ message: "Source invalide." });
    }

    if (!reservation) {
      return res.status(404).json({ message: "Réservation introuvable." });
    }

    const timeSlot = reservation.timeSlot;
    if (!timeSlot) {
      return res.status(400).json({ message: "Créneau horaire introuvable pour cette réservation." });
    }

    // Extract scenario and chapter names
    const scenarioName = reservation.scenario?.name || "Scénario inconnu";
    const chapterName = reservation.chapter?.name || "Chapitre inconnu";

    // Extract other details
    const reservationDate = `${new Date(timeSlot.startTime).toLocaleString("fr-FR")} - ${new Date(
      timeSlot.endTime
    ).toLocaleString("fr-FR")}`;
    const { name, email, phone, language, people } = reservation;

    if (status === "approved") {
      // Move to ApprovedReservation
      const approvedReservation = new ApprovedReservation({
        ...reservation.toObject(),
        status: "approved",
      });
      await approvedReservation.save();

      // Update time slot
      timeSlot.status = "booked";
      timeSlot.isAvailable = false;
      await timeSlot.save();

      // Enhanced Approval Email
      const approvalEmailContent = `
        <html>
          <head>
            <title>Réservation Approuvée</title>
            <meta charset="UTF-8" />
            <style>
              body {
                font-family: Arial, sans-serif;
                background: #f5f5f5;
                color: #333;
                margin: 0;
                padding: 0;
              }
              .email-container {
                max-width: 600px;
                margin: 30px auto;
                background: #ffffff;
                border-radius: 8px;
                overflow: hidden;
                border: 1px solid #ddd;
              }
              .header {
                background: #4CAF50;
                color: #ffffff;
                padding: 20px;
                text-align: center;
              }
              .header h1 {
                margin: 0;
                font-size: 24px;
                font-weight: normal;
              }
              .content {
                padding: 20px;
              }
              .content h2 {
                margin-top: 0;
                color: #333;
              }
              .details {
                margin-bottom: 20px;
              }
              .details p {
                margin: 5px 0;
              }
              .footer {
                background: #f0f0f0;
                padding: 10px;
                text-align: center;
                font-size: 14px;
                color: #666;
              }
              .highlight {
                color: #4CAF50;
                font-weight: bold;
              }
              .section-title {
                margin-top: 20px;
                font-weight: bold;
                color: #333;
                border-bottom: 1px solid #ddd;
                padding-bottom: 5px;
              }
            </style>
          </head>
          <body>
            <div class="email-container">
              <div class="header">
                <h1>Votre Réservation a été Approuvée</h1>
              </div>
              <div class="content">
                <h2>Bonjour ${name},</h2>
                <p>Excellente nouvelle ! Votre réservation a été approuvée. Vous trouverez ci-dessous tous les détails :</p>
                
                <div class="section-title">Détails de la Réservation</div>
                <div class="details">
                  <p><strong>ID de Réservation :</strong> ${reservation._id}</p>
                  <p><strong>Scénario :</strong> ${scenarioName}</p>
                  <p><strong>Chapitre :</strong> ${chapterName}</p>
                  <p><strong>Créneau Horaire :</strong> ${reservationDate}</p>
                  <p><strong>Langue :</strong> ${language || "Non spécifiée"}</p>
                  <p><strong>Nombre de Personnes :</strong> ${people || "Non spécifié"}</p>
                </div>

                <div class="section-title">Informations du Client</div>
                <div class="details">
                  <p><strong>Nom :</strong> ${name}</p>
                  <p><strong>Email :</strong> ${email}</p>
                  <p><strong>Téléphone :</strong> ${phone}</p>
                </div>
                
                <p class="highlight">Statut : Approuvé</p>
                <p>Merci d'avoir choisi notre service. Nous sommes impatients de vous accueillir !</p>
              </div>
              <div class="footer">
                &copy; ${new Date().getFullYear()} Votre Société - Tous droits réservés.
              </div>
            </div>
          </body>
        </html>
      `;
      await sendEmail(email, "Votre Réservation a été Approuvée", approvalEmailContent);

      // Remove from original source
      if (source === "declinedReservations") {
        await DeclinedReservation.findByIdAndDelete(reservationId);
      } else {
        await Reservation.findByIdAndDelete(reservationId);
      }
    } else if (status === "declined") {
      // Move to DeclinedReservation
      const declinedReservation = new DeclinedReservation({
        ...reservation.toObject(),
        status: "declined",
      });
      await declinedReservation.save();

      // Update time slot
      timeSlot.status = "available";
      timeSlot.isAvailable = true;
      await timeSlot.save();

      const isFromApproved = source === "approvedReservations";
      const declineTitle = isFromApproved
        ? "Réservation Refusée pour Problèmes Techniques"
        : "Réservation Refusée";
      const declineMessage = isFromApproved
        ? "Malheureusement, nous devons refuser votre réservation en raison de problèmes techniques imprévus. Nous nous excusons pour la gêne occasionnée."
        : "Votre réservation a été refusée. Veuillez choisir un autre créneau horaire et réessayer.";

      const declineEmailContent = `
        <html>
          <head>
            <title>Réservation Refusée</title>
            <meta charset="UTF-8" />
            <style>
              body {
                font-family: Arial, sans-serif;
                background: #f5f5f5;
                color: #333;
                margin: 0;
                padding: 0;
              }
              .email-container {
                max-width: 600px;
                margin: 30px auto;
                background: #ffffff;
                border-radius: 8px;
                overflow: hidden;
                border: 1px solid #ddd;
              }
              .header {
                background: #FF5733;
                color: #ffffff;
                padding: 20px;
                text-align: center;
              }
              .header h1 {
                margin: 0;
                font-size: 22px;
                font-weight: normal;
              }
              .content {
                padding: 20px;
              }
              .content h2 {
                margin-top: 0;
                color: #333;
              }
              .details {
                margin-bottom: 20px;
              }
              .details p {
                margin: 5px 0;
              }
              .footer {
                background: #f0f0f0;
                padding: 10px;
                text-align: center;
                font-size: 14px;
                color: #666;
              }
              .highlight {
                color: #FF5733;
                font-weight: bold;
              }
              .section-title {
                margin-top: 20px;
                font-weight: bold;
                color: #333;
                border-bottom: 1px solid #ddd;
                padding-bottom: 5px;
              }
            </style>
          </head>
          <body>
            <div class="email-container">
              <div class="header">
                <h1>${declineTitle}</h1>
              </div>
              <div class="content">
                <h2>Bonjour ${name},</h2>
                <p>${declineMessage}</p>

                <div class="section-title">Détails de la Réservation</div>
                <div class="details">
                  <p><strong>ID de Réservation :</strong> ${reservation._id}</p>
                  <p><strong>Scénario :</strong> ${scenarioName}</p>
                  <p><strong>Chapitre :</strong> ${chapterName}</p>
                  <p><strong>Créneau Horaire :</strong> ${reservationDate}</p>
                  <p><strong>Langue :</strong> ${language || "Non spécifiée"}</p>
                  <p><strong>Nombre de Personnes :</strong> ${people || "Non spécifié"}</p>
                </div>

                <div class="section-title">Informations du Client</div>
                <div class="details">
                  <p><strong>Nom :</strong> ${name}</p>
                  <p><strong>Email :</strong> ${email}</p>
                  <p><strong>Téléphone :</strong> ${phone}</p>
                </div>

                <p class="highlight">Statut : Refusé</p>
              </div>
              <div class="footer">
                &copy; ${new Date().getFullYear()} Votre Société - Tous droits réservés.
              </div>
            </div>
          </body>
        </html>
      `;
      await sendEmail(email, "Votre Réservation a été Refusée", declineEmailContent);

      // Remove from original source
      if (source === "approvedReservations") {
        await ApprovedReservation.findByIdAndDelete(reservationId);
      } else {
        await Reservation.findByIdAndDelete(reservationId);
      }
    } else {
      return res.status(400).json({ message: "Statut invalide. Utilisez 'approved' ou 'declined'." });
    }

    res.status(200).json({ message: "Le statut de la réservation a été mis à jour avec succès." });
  } catch (error) {
    console.error("Erreur lors de la mise à jour du statut de la réservation :", error);
    res.status(500).json({ message: "Erreur interne du serveur." });
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
