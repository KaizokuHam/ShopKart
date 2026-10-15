import Navbar from "../components/Navbar.jsx";
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useState } from 'react'
import { changePassword } from '../services/api.js'

function Profile() {
  const { user } = useAuth()
  const [passwords, setPasswords] = useState({ oldPassword: "", newPassword: "", confirmPassword: "" });
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const submitPassword = async event => {
    event.preventDefault();
    if (saving) return;
    if (passwords.newPassword !== passwords.confirmPassword) { setFeedback({ error: true, message: "New passwords must match." }); return; }
    setSaving(true); setFeedback(null);
    try {
      const result = await changePassword({ oldPassword: passwords.oldPassword, newPassword: passwords.newPassword });
      setFeedback({ error: false, message: result.message });
      setPasswords({ oldPassword: "", newPassword: "", confirmPassword: "" });
    } catch (error) { setFeedback({ error: true, message: error.response?.data?.message || "Unable to change your password. Try again." }); }
    finally { setSaving(false); }
  };

  if (!user) {
    return <main className="profile-page profile-loading">Loading profile...</main>
  }

  return (
    <>
    <Navbar />
    <main className="profile-page route-enter">
      <section className="profile-intro">
        <p className="eyebrow">Your account</p>
        <h1>Welcome, {user.fullName}</h1>
        <p>Your ShopKart account details, ready for your next order.</p>
        <Link className="primary-button profile-home-button" to="/home">
          Back to home <span aria-hidden="true">-&gt;</span>
        </Link>
      </section>
      <section className="password-panel" aria-labelledby="password-title">
        <p className="eyebrow">Account security</p><h2 id="password-title">Change password</h2>
        <form onSubmit={submitPassword}>
          {[{ name: "oldPassword", label: "Current password", autoComplete: "current-password" }, { name: "newPassword", label: "New password", autoComplete: "new-password" }, { name: "confirmPassword", label: "Confirm new password", autoComplete: "new-password" }].map(field => <label key={field.name}>{field.label}<input type="password" name={field.name} autoComplete={field.autoComplete} required minLength={field.name === "oldPassword" ? undefined : 6} value={passwords[field.name]} onChange={event => setPasswords(current => ({ ...current, [field.name]: event.target.value }))} /></label>)}
          {feedback && <p role={feedback.error ? "alert" : "status"}>{feedback.message}</p>}
          <button type="submit" className="primary-button" disabled={saving}>{saving ? "Updating password…" : "Update password"}</button>
        </form>
      </section>

      <section className="profile-card" aria-labelledby="profile-details-title">
        <div className="profile-avatar" aria-hidden="true">
          {user.fullName?.charAt(0).toUpperCase()}
        </div>
        <div className="profile-details">
          <div className="profile-card-heading">
            <div>
              <p className="eyebrow">Personal details</p>
              <h2 id="profile-details-title">Profile information</h2>
            </div>
            <span className="profile-status">Active</span>
          </div>
          <dl className="profile-fields">
            <div>
              <dt>Full name</dt>
              <dd>{user.fullName}</dd>
            </div>
            <div>
              <dt>Email address</dt>
              <dd>{user.email}</dd>
            </div>
            <div>
              <dt>Phone number</dt>
              <dd>{user.phone}</dd>
            </div>
          </dl>
        </div>
      </section>
    </main>
    </>
  )
}

export default Profile
