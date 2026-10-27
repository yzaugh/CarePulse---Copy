function openBookingModal() {
  document.getElementById('bookingModal').style.display = 'flex';
}

function closeBookingModal() {
  document.getElementById('bookingModal').style.display = 'none';
}

function handleBookingSubmit(event) {
  event.preventDefault();
  alert('Thank you! Your appointment request has been submitted successfully.');
  closeBookingModal();
  document.getElementById('appointmentForm').reset();
}

window.onclick = function(event) {
  const modal = document.getElementById('bookingModal');
  if (event.target === modal) {
    closeBookingModal();
  }
}