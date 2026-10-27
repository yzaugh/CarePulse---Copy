###System Set up###

1. inhale & exhale lui
2. check if xampp's MYSQL is port 3306 (run first if it works even if diferent port, if not, find a way to make the port 3306)
<img width="307" height="128" alt="{91E62F17-F61A-4647-B333-4E77C76B2323}" src="https://github.com/user-attachments/assets/c8f04016-e61d-419c-a8b5-e19d8b883c67" />

3. clone it at xampp\htdocs path
   
4. ```bash
   git clone https://github.com/yzaugh/DBMS.git
   ```

5. ##carepulse_db.sql## should be put at PHPMYADMIN'S SQL (IMPORT FILE)
   
7. Run it at
8. ```bash
   http://localhost/DBMS/
   ```

For an existing database, run `inventory-stock-tracking.sql` once in phpMyAdmin
to enable per-receipt expiry batches and stock activity tracking. This migration
also removes the unused reorder-level field and converts the current stock into
opening batches. Run `seed-inventory.sql` afterward only if you want the sample
inventory items; it is safe to rerun.

Inventory receipts and dispenses are recorded as stock activity. Dispensing
requires selecting a registered patient, and expired batches are removed from
available stock when the inventory dashboard loads. Medicine dispense summaries
show the all-time number of patients and quantity dispensed for each medicine.
   
P.S I added some functionalities especially edit, delete, view, add features.

## Patient self-registration

Patients can create an account from the login page. They must verify
their email address before signing in. On Windows/XAMPP, configure
`C:\xampp\sendmail\sendmail.ini` with your SMTP provider's host, port, TLS
mode, username, password/app password, and sender address. Point
`sendmail_path` in the active XAMPP `php.ini` `[mail function]` section to
`C:\xampp\sendmail\sendmail.exe -t`, and set `sendmail_from` to an address
accepted by the SMTP provider. Restart Apache after changing the configuration.
For Gmail, use an app password rather than your account password. Do not put
mail passwords in this repository.

Optionally configure `CARE_PULSE_FROM_EMAIL` to set the sender address (it must
be accepted by your SMTP relay) and
`CARE_PULSE_BASE_URL` to the site's base URL so verification links point to the
correct site. Do not use `localhost` or `127.0.0.1` in this setting: those
addresses refer to the device opening the link, so they will not work from a
phone.

For phone testing on the same Wi-Fi network, set `CARE_PULSE_BASE_URL` to the
computer's LAN IPv4 address and the site's folder path, for example
`http://192.168.1.25/CarePulse%20-%20Copy`. Find the computer's address with
`ipconfig` (`IPv4 Address`), include a non-default Apache port if applicable,
allow Apache through Windows Firewall, and make sure the phone can open that
URL before registering. Set the Windows environment variable, then restart
XAMPP/Apache so PHP receives it. For a deployed site, use its public HTTPS
domain instead. If this setting is absent, the app uses the host used to open
the registration page; opening it on the computer as `localhost` is rejected
so an unusable email link is not sent.

The verification-token table is created automatically for existing databases
and is also included in `carepulse_db.sql` for new installs.

New passwords are stored as secure hashes. Existing plaintext passwords remain
usable; the next successful login upgrades each one to a password hash.
