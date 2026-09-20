"use client";
import { useState } from "react";
export function ChangePassword() {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <section className="panel settings-section">
      <div className="settings-copy">
        <h3>Change password</h3>
        <p>
          Other browser sessions will be signed out. This browser stays signed
          in.
        </p>
        <form
          className="history-editor"
          onSubmit={async (event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const data = new FormData(form);
            if (data.get("newPassword") !== data.get("confirmPassword")) {
              setMessage("New passwords do not match.");
              return;
            }
            setBusy(true);
            setMessage("");
            try {
              const response = await fetch("/api/auth/password", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                  currentPassword: data.get("currentPassword"),
                  newPassword: data.get("newPassword"),
                }),
              });
              const result = await response.json();
              if (!response.ok)
                throw Error(result.error ?? "Could not change password.");
              form.reset();
              setMessage("Password changed. Other browsers are signed out.");
            } catch (error) {
              setMessage(
                error instanceof Error
                  ? error.message
                  : "Could not change password.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Current password
            <input
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              required
              maxLength={128}
            />
          </label>
          <label>
            New password
            <input
              name="newPassword"
              type="password"
              autoComplete="new-password"
              minLength={10}
              maxLength={128}
              required
            />
          </label>
          <label>
            Confirm new password
            <input
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              minLength={10}
              maxLength={128}
              required
            />
          </label>
          <button className="secondary-button compact" disabled={busy}>
            {busy ? "Updating…" : "Update password"}
          </button>
          <span role="status">{message}</span>
        </form>
      </div>
    </section>
  );
}
