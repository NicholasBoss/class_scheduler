import React, { useEffect } from 'react';
import axios from 'axios';
import { GoogleLogin } from '@react-oauth/google';
import './Login.css';
import logo from '../images/byui_class_scheduler_logo.png';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

function Login({ onLogin }) {
    const handleGoogleLogin = async (credentialResponse) => {
        try {
            // Send credential to backend to verify and get token
            const response = await axios.post(`${API_BASE_URL}/auth/google-login`, {
                token: credentialResponse.credential
            });

            if (response.data.success) {
                onLogin(response.data.token, response.data.user);
            }
        } catch (err) {
            console.error('Login failed:', err);
            alert('Login failed. Please try again.');
        }
    };

    return (
        <div className="login-container">
            <div className="login-box">
                <img src={logo} alt="BYU-I Class Scheduler Logo" className="login-logo" />
                <h1>Class Scheduler</h1>
                <p>Sign in with your Google account</p>
                <GoogleLogin
                    onSuccess={handleGoogleLogin}
                    onError={() => console.error('Login failed')}
                />
            </div>
        </div>
    );
}

export default Login;
