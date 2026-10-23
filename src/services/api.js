import axios from 'axios';

const getBaseUrl = () => {
    // If running in the browser, check hostname
    const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
    
    // Development and UAT domains
    const uatDomains = ['dev.khelclub.org', 'uat.khelclub.org'];
    
    // If it's localhost, force it to use your local Flask backend
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
        console.log('Using local Flask backend endpoint');
        return "http://localhost:5000";
    }
    
    // Check if current domain is in UAT domains list
    if (uatDomains.includes(hostname)) {
        console.log('Using UAT API endpoint');
        return "https://uat-api.khelclub.org";
    }
    
    console.log('Using production API endpoint');
    return "https://api.khelclub.org";
};

// Create axios instance with default config
export const api = axios.create({
  baseURL: getBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor for authentication if needed
api.interceptors.request.use((config) => {
  // Get token from localStorage or wherever you store it
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Add response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Handle unauthorized access
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);
);
