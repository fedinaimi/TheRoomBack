const Reservation = require('../models/Reservation');
const TimeSlot = require('../models/TimeSlot');
const sendEmail = require('../utils/sendEmail');
const Notification = require('../models/Notifications');
const User = require('../models/User'); // Import the User model
const { format } = require('date-fns'); // Use date-fns to format dates




// Create a new reservation
exports.createReservation = async (req, res) => {
  try {
    const { scenario, chapter, timeSlot, name, email, phone, language } = req.body;

    // Validate required fields
    if (!scenario || !chapter || !timeSlot || !name || !email || !phone) {
      return res.status(400).json({ message: 'All fields are required: scenario, chapter, timeSlot, name, email, and phone.' });
    }

    // Check if the time slot exists and is available
    const timeSlotData = await TimeSlot.findById(timeSlot);
    if (!timeSlotData || !timeSlotData.isAvailable) {
      return res.status(400).json({ message: 'Time slot not available or does not exist.' });
    }

    // Create a new reservation
    const reservation = new Reservation({ scenario, chapter, timeSlot, name, email, phone, language });
    await reservation.save();

    // Mark time slot as unavailable
    timeSlotData.isAvailable = false;
    await timeSlotData.save();

    // Populate the reservation with scenario and chapter names
    const populatedReservation = await Reservation.findById(reservation._id)
      .populate('scenario')
      .populate('chapter');

    // Format the date and time
    const formattedStartTime = new Date(timeSlotData.startTime).toLocaleString("en-US", {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: 'numeric', hour12: true
    });

    const formattedEndTime = new Date(timeSlotData.endTime).toLocaleString("en-US", {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: 'numeric', hour12: true
    });

    const createdAt = new Date(reservation.createdAt).toLocaleString("en-US", {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: 'numeric', hour12: true
    });

    // Create a notification for the reservation
    const notification = new Notification({
      message: `New reservation by ${name}`,
      reservationId: reservation._id,
      details: `Reservation for scenario: ${populatedReservation.scenario.title}, chapter: ${populatedReservation.chapter.name}, time slot: ${formattedStartTime} - ${formattedEndTime}.`,
    });
    await notification.save();

    // Send email notifications to admin
    const admins = await User.find({ usertype: { $in: ['admin', 'subadmin'] } }).select('email');
    const adminEmails = admins.map((admin) => admin.email);

    // HTML Email template for admins and customer
    const emailContent = `
      <html>
        <head><title>Reservation Details</title></head>
        <body style="font-family: Arial, sans-serif; color: #333;">
          <h1 style="text-align: center; color: #4CAF50;">Reservation Confirmation</h1>
          <p><strong>Reservation ID:</strong> ${reservation._id}</p>
          <p><strong>Chapter:</strong> ${populatedReservation.chapter.name}</p>
          <p><strong>Time Slot:</strong> ${formattedStartTime} - ${formattedEndTime}</p>
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Phone:</strong> ${phone}</p>
          <p><strong>Language:</strong> ${language || 'Not specified'}</p>
          <p><strong>Status:</strong> Pending</p>
          <p><strong>Created At:</strong> ${createdAt}</p>
          <p><strong>Reservation Message:</strong> A new reservation has been created. Please approve or decline it.</p>
        </body>
      </html>
    `;

    // Send email to all admins
    for (const adminEmail of adminEmails) {
      await sendEmail(adminEmail, 'New Reservation Created', emailContent);
    }

    // Send confirmation email to the customer
    const customerEmailContent = `
      <html>
        <head><title>Your Reservation Status</title></head>
        <body style="font-family: Arial, sans-serif; color: #333;">
          <h1 style="text-align: center; color: #4CAF50;">Your Reservation Has Been Received</h1>
          <p><strong>Reservation ID:</strong> ${reservation._id}</p>
          <p><strong>Chapter:</strong> ${populatedReservation.chapter.name}</p>
          <p><strong>Time Slot:</strong> ${formattedStartTime} - ${formattedEndTime}</p>
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Phone:</strong> ${phone}</p>
          <p><strong>Language:</strong> ${language || 'Not specified'}</p>
          <p><strong>Status:</strong> Pending</p>
          <p><strong>Created At:</strong> ${createdAt}</p>
         <p style="color: red;">Veuillez patienter l'admin d'accepter votre invitation. Vous recevrez un email une fois approuvé.</p>

      </html>
    `;

    // Send the confirmation email to the customer
    await sendEmail(email, 'TheRoom Reservation ', customerEmailContent);

    res.status(201).json({ message: 'Reservation created successfully', reservation });
  } catch (error) {
    console.error('Error creating reservation:', error.message || error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};




// Get all reservations (admin)

exports.getAllReservations = async (req, res) => {
  try {
    const reservations = await Reservation.find()
      .populate('scenario')
      .populate('chapter')
      .populate('timeSlot');

    // Format dates
    const formattedReservations = reservations.map(reservation => {
      reservation.createdAtFormatted = format(new Date(reservation.createdAt), 'yyyy-MM-dd HH:mm:ss');
      if (reservation.timeSlot) {
        reservation.timeSlot.startTimeFormatted = format(new Date(reservation.timeSlot.startTime), 'yyyy-MM-dd HH:mm:ss');
        reservation.timeSlot.endTimeFormatted = format(new Date(reservation.timeSlot.endTime), 'yyyy-MM-dd HH:mm:ss');
      }
      return reservation;
    });

    res.status(200).json(formattedReservations);
  } catch (error) {
    console.error('Error fetching reservations:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};




// Update reservation status (admin)
exports.updateReservationStatus = async (req, res) => {
  try {
    const { status } = req.body; // 'approved' or 'declined'
    const reservation = await Reservation.findById(req.params.id).populate('timeSlot');
    if (!reservation) {
      return res.status(404).json({ message: 'Reservation not found' });
    }

    reservation.status = status;
    await reservation.save();

    const timeSlot = reservation.timeSlot;

    if (status === 'approved') {
      const emailContent = `
        <html>
          <head><title>Reservation Approved</title></head>
          <body style="font-family: Arial, sans-serif; color: #333;">
            <h1 style="text-align: center; color: #4CAF50;">Your Reservation Has Been Approved</h1>
            <p>Dear ${reservation.name},</p>
            <p>We are pleased to inform you that your reservation has been approved.</p>
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
      await sendEmail(reservation.email, 'Reservation Approved', emailContent);
    } else if (status === 'declined') {
      timeSlot.isAvailable = true;
      await timeSlot.save();
      const emailContent = `
        <html>
          <head><title>Reservation Declined</title></head>
          <body style="font-family: Arial, sans-serif; color: #333;">
            <h1 style="text-align: center; color: #FF5733;">Your Reservation Has Been Declined</h1>
            <p>Dear ${reservation.name},</p>
            <p>We regret to inform you that your reservation has been declined.</p>
            <p>Please choose another time slot and try again.</p>
            <p><strong>Reservation Details:</strong></p>
            <ul>
              <li><strong>Reservation ID:</strong> ${reservation._id}</li>
              <li><strong>Requested Time Slot:</strong> ${new Date(timeSlot.startTime).toLocaleString()} - ${new Date(timeSlot.endTime).toLocaleString()}</li>
              <li><strong>Status:</strong> Declined</li>
            </ul>
          </body>
        </html>
      `;
      await sendEmail(reservation.email, 'Reservation Declined', emailContent);
    }

    res.status(200).json({ message: 'Reservation status updated successfully', reservation });
  } catch (error) {
    console.error('Error updating reservation status:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

exports.deleteReservation = async (req, res) => {
  try {
    const reservation = await Reservation.findByIdAndDelete(req.params.id);
    if (!reservation) {
      return res.status(404).json({ message: 'Reservation not found' });
    }
    res.status(200).json({ message: 'Reservation deleted successfully' });
  } catch (error) {
    console.error('Error deleting reservation:', error);
    res.status(500).json({ message: 'Internal Server Error' });
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
