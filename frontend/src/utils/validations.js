/**
 * Common validation functions for use with InputField component
 * Each function returns true if valid, or an error message string if invalid
 */

export const validations = {
  /**
   * Email validation
   */
  email: (value) => {
    if (!value) return true; // Allow empty values
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value) ? true : 'Please enter a valid email address';
  },

  /**
   * Strong password validation
   * Requires: min 8 chars, uppercase, lowercase, number, special char
   */
  strongPassword: (value) => {
    if (!value) return true;
    if (value.length < 8) {
      return 'Password must be at least 8 characters';
    }
    if (!/(?=.*[a-z])/.test(value)) {
      return 'Password must contain at least one lowercase letter';
    }
    if (!/(?=.*[A-Z])/.test(value)) {
      return 'Password must contain at least one uppercase letter';
    }
    if (!/(?=.*\d)/.test(value)) {
      return 'Password must contain at least one number';
    }
    if (!/(?=.*[@$!%*?&#])/.test(value)) {
      return 'Password must contain at least one special character (@$!%*?&#)';
    }
    return true;
  },
 
  /**
   * Medium password validation
   * Requires: min 8 chars, uppercase, lowercase, number
   */
  mediumPassword: (value) => {
    if (!value) return true;
    if (value.length < 8) {
      return 'Password must be at least 8 characters';
    }
    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(value)) {
      return 'Password must contain uppercase, lowercase, and number';
    }
    return true;
  },

  /**
   * Indian mobile number: 10 digits starting with 6-9 (an optional +91 or 0
   * in front is allowed).
   */
  phone: (value) => {
    if (!value) return true;
    const phoneRegex = /^(?:\+91[\s-]?|0)?[6-9]\d{9}$/;
    return phoneRegex.test(value.trim()) ? true : 'Please enter a valid 10-digit mobile number';
  },

  /**
   * URL validation
   */
  url: (value) => {
    if (!value) return true;
    try {
      new URL(value);
      return true;
    } catch {
      return 'Please enter a valid URL (e.g., https://example.com)';
    }
  },

  /**
   * Alphanumeric only (letters and numbers)
   */
  alphanumeric: (value) => {
    if (!value) return true;
    const alphanumericRegex = /^[a-zA-Z0-9]+$/;
    return alphanumericRegex.test(value) ? true : 'Only letters and numbers are allowed';
  },

  /**
   * Letters only (no numbers or special characters)
   */
  lettersOnly: (value) => {
    if (!value) return true;
    const lettersRegex = /^[a-zA-Z\s]+$/;
    return lettersRegex.test(value) ? true : 'Only letters are allowed';
  },

  /**
   * Numbers only
   */
  numbersOnly: (value) => {
    if (!value) return true;
    const numbersRegex = /^[0-9]+$/;
    return numbersRegex.test(value) ? true : 'Only numbers are allowed';
  },

  /**
   * No spaces allowed
   */
  noSpaces: (value) => {
    return !value.includes(' ') ? true : 'Spaces are not allowed';
  },

  /**
   * Username validation (alphanumeric, underscore, hyphen)
   */
  username: (value) => {
    if (!value) return true;
    if (value.length < 3) {
      return 'Username must be at least 3 characters';
    }
    if (value.length > 20) {
      return 'Username must not exceed 20 characters';
    }
    const usernameRegex = /^[a-zA-Z0-9_-]+$/;
    return usernameRegex.test(value) 
      ? true 
      : 'Username can only contain letters, numbers, underscores, and hyphens';
  },

  /**
   * Indian PIN code: 6 digits, not starting with 0.
   */
  pincode: (value) => {
    if (!value) return true;
    return /^[1-9]\d{5}$/.test(value.trim()) ? true : 'Please enter a valid 6-digit PIN code';
  },

  /**
   * Date validation (YYYY-MM-DD format)
   */
  dateFormat: (value) => {
    if (!value) return true;
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(value)) {
      return 'Please use YYYY-MM-DD format';
    }
    const date = new Date(value);
    return !isNaN(date.getTime()) ? true : 'Please enter a valid date';
  },

  /**
   * Age validation (18+)
   */
  minAge18: (value) => {
    if (!value) return true;
    const age = parseInt(value);
    if (isNaN(age)) {
      return 'Please enter a valid age';
    }
    return age >= 18 ? true : 'You must be at least 18 years old';
  },

  /**
   * IP Address validation (IPv4)
   */
  ipAddress: (value) => {
    if (!value) return true;
    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    return ipRegex.test(value) ? true : 'Please enter a valid IP address';
  },

  /**
   * Custom min/max value validation generator
   */
  numberRange: (min, max) => {
    return (value) => {
      if (!value) return true;
      const num = parseFloat(value);
      if (isNaN(num)) {
        return 'Please enter a valid number';
      }
      if (num < min) {
        return `Value must be at least ${min}`;
      }
      if (num > max) {
        return `Value must not exceed ${max}`;
      }
      return true;
    };
  },

  /**
   * Custom regex validation generator
   */
  customRegex: (regex, errorMessage) => {
    return (value) => {
      if (!value) return true;
      return regex.test(value) ? true : errorMessage;
    };
  },

  /**
   * Match another field (useful for password confirmation)
   */
  matchField: (otherValue, fieldName = 'password') => {
    return (value) => {
      return value === otherValue 
        ? true 
        : `${fieldName.charAt(0).toUpperCase() + fieldName.slice(1)}s do not match`;
    };
  },

  /**
   * File extension validation (for file input type)
   */
  fileExtension: (allowedExtensions = []) => {
    return (value) => {
      if (!value) return true;
      const extension = value.split('.').pop().toLowerCase();
      return allowedExtensions.includes(extension)
        ? true
        : `Only ${allowedExtensions.join(', ')} files are allowed`;
    };
  },

};

/**
 * Compose multiple validations
 * @param {...Function} validators - Validation functions to combine
 */
export const composeValidations = (...validators) => {
  return validators.filter(Boolean);
};

/**
 * Create a required validation
 */
export const required = (message = 'This field is required') => {
  return (value) => {
    return value !== null && value !== undefined && String(value).trim().length > 0 ? true : message;
  };
};

export default validations;
