document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('registration-form');
  const message = document.getElementById('registration-message');
  const submit = document.getElementById('register-submit');
  const middleName = document.getElementById('register-middle-name');
  const noMiddleName = document.getElementById('register-no-middle-name');
  const suffix = document.getElementById('register-suffix');
  const noSuffix = document.getElementById('register-no-suffix');

  noMiddleName.addEventListener('change', () => {
    middleName.disabled = noMiddleName.checked;
    if (noMiddleName.checked) middleName.value = '';
  });

  noSuffix.addEventListener('change', () => {
    suffix.disabled = noSuffix.checked;
    if (noSuffix.checked) suffix.value = '';
  });

  form.addEventListener('submit', async event => {
    event.preventDefault();

    const nameParts = [
      document.getElementById('register-first-name').value.trim(),
      noMiddleName.checked ? '' : middleName.value.trim(),
      document.getElementById('register-last-name').value.trim(),
      noSuffix.checked ? '' : suffix.value.trim()
    ].filter(Boolean);
    const fullName = nameParts.join(' ');
    if (fullName.length > 100) {
      message.textContent = 'Your full name must be 100 characters or fewer.';
      return;
    }

    const password = document.getElementById('register-password').value;
    const confirmation = document.getElementById('register-password-confirm').value;
    if (password !== confirmation) {
      message.textContent = 'The passwords do not match.';
      return;
    }

    const body = Object.fromEntries(new FormData(form).entries());
    body.name = fullName;
    delete body.first_name;
    delete body.middle_name;
    delete body.last_name;
    delete body.suffix;
    delete body['register-no-middle-name'];
    delete body['register-no-suffix'];
    delete body.password_confirmation;
    message.textContent = 'Creating your account...';
    submit.disabled = true;

    try {
      const response = await fetch('patient-registration.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Unable to create your account.');
      }

      form.hidden = true;
      message.textContent = result.message;
    } catch (error) {
      message.textContent = error.message;
      submit.disabled = false;
    }
  });
});
