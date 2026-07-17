/**
 * Global Configuration
 * Centralized source of truth for all environment-based settings.
 */

export const CONFIG = {
  // API URL for backend communication
  // Falls back to localhost:8000 if VITE_API_URL is not provided
  API_URL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  
  // You can add more configuration flags here as needed
  // IS_DEV: import.meta.env.DEV,
};

export default CONFIG;
