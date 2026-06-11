import { useState } from 'react';

function Register() {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Update component state dynamically as the user types
  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // 1. Client-side Validation (Fails early before sending network traffic)
    if (formData.username.trim().length < 3 || formData.username.length > 32) {
      setError('Username must be between 3 and 32 characters.');
      return;
    }
    if (formData.password.length < 6 || formData.password.length > 72) {
      setError('Password must be between 6 and 72 characters.');
      return;
    }

    try {
      // 2. Microservice API Integration via your Gateway-Service port (8080)
      const response = await fetch('http://localhost:8001/api/v1/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        // Matches your backend Go payload properties perfectly:
        // Prioritizes data.error (like "email already registered") or falls back gracefully
        throw new Error(data.error || data.message || 'Registration failed');
      }

      // 3. Success state updates matching your backend: data.message ("User registered successfully")
      setSuccess(data.message || 'Registration successful! Welcome aboard.');
      setFormData({ username: '', email: '', password: '' }); // Clear form fields
    } catch (err) {
      // Captures API rejection responses OR full network downtime (e.g., Gateway service turned off)
      setError(err.message || 'Internal connection error');
    }
  };

  return (
    <div style={{ maxWidth: '400px', margin: '50px auto', padding: '20px', fontFamily: 'sans-serif', border: '1px solid #ccc', borderRadius: '8px' }}>
      <h1 style={{ marginTop: 0 }}>Register Account</h1>
      
      {error && <div style={{ color: '#ff4d4d', marginBottom: '15px', fontWeight: 'bold', fontSize: '14px', whiteSpace: 'pre-line' }}>⚠️ {error}</div>}
      {success && <div style={{ color: '#2ecc71', marginBottom: '15px', fontWeight: 'bold', fontSize: '14px' }}>✅ {success}</div>}

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>Username:</label>
          <input
            type="text"
            name="username"
            value={formData.username}
            onChange={handleChange}
            style={{ width: '100%', padding: '10px', boxSizing: 'border-box', borderRadius: '4px', border: '1px solid #ccc' }}
            required
          />
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>Email Address:</label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            style={{ width: '100%', padding: '10px', boxSizing: 'border-box', borderRadius: '4px', border: '1px solid #ccc' }}
            required
          />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>Password:</label>
          <input
            type="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            style={{ width: '100%', padding: '10px', boxSizing: 'border-box', borderRadius: '4px', border: '1px solid #ccc' }}
            required
          />
        </div>

        <button type="submit" style={{ width: '100%', padding: '12px', backgroundColor: '#0070f3', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px' }}>
          Register
        </button>
      </form>
    </div>
  );
}

export default Register;