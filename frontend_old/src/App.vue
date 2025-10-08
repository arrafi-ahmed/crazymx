<script setup>
import { Toaster } from 'vue-sonner'
import ProgressLoader from '@/components/ProgressLoader.vue'
import { watch } from 'vue'
import { useRoute } from 'vue-router'
import { appInfo } from '@/others/util'

const route = useRoute()
const toastOptions = {
  class: 'pa-3',
  style: { fontFamily: "'Poppins', sans-serif" },
}

watch(route, (to) => {
  document.title = (to.meta.title && to.meta.title + ' | ' + appInfo.name) || appInfo.name
})
</script>
<template>
  <progress-loader />
  <Toaster
    :toast-options="toastOptions"
    close-button
    expand
    position="bottom-left"
    rich-colors
    theme="dark"
  />
  <router-view />
</template>
<style>
@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap');

/* ===== GLOBAL DESIGN SYSTEM ===== */
:root {
  /* Spacing System - 8px Grid */
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 16px;
  --space-lg: 24px;
  --space-xl: 32px;
  --space-2xl: 40px;
  --space-3xl: 48px;
  --space-4xl: 64px;

  /* Border Radius */
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --space-xl: 20px;
  --space-2xl: 24px;

  /* Typography Scale */
  --font-size-xs: 0.75rem; /* 12px */
  --font-size-sm: 0.875rem; /* 14px */
  --font-size-base: 1rem; /* 16px */
  --font-size-lg: 1.125rem; /* 18px */
  --font-size-xl: 1.25rem; /* 20px */
  --font-size-2xl: 1.5rem; /* 24px */
  --font-size-3xl: 1.75rem; /* 28px */
  --font-size-4xl: 2rem; /* 32px */

  /* Font Weights */
  --font-weight-light: 300;
  --font-weight-normal: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --font-weight-bold: 700;

  /* Shadows */
  --shadow-sm: 0 2px 4px rgba(0, 0, 0, 0.1);
  --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.15);
  --shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.15);
  --shadow-xl: 0 20px 40px rgba(0, 0, 0, 0.15);

  /* Transitions */
  --transition-fast: 0.15s ease;
  --transition-normal: 0.3s ease;
  --transition-slow: 0.5s ease;

  /* Z-Index Scale */
  --z-dropdown: 1000;
  --z-sticky: 1020;
  --z-fixed: 1030;
  --z-modal-backdrop: 1040;
  --z-modal: 1050;
  --z-popover: 1060;
  --z-tooltip: 1070;
  --z-toast: 1080;
}

/* ===== GLOBAL STYLES ===== */
.v-application {
  font-family: 'Poppins', sans-serif;
  color: var(--text-primary);
  background: var(--bg-primary);
}

body,
.custom-toast {
  font-family: 'Poppins', sans-serif !important;
}

/* ===== UTILITY CLASSES ===== */
.clickable {
  cursor: pointer;
  transition: var(--transition-fast);
}

.clickable:hover {
  transform: translateY(-1px);
}

.v-chip-0-padding {
  padding: 0 !important;
}

.flex-sticky {
  position: sticky;
  align-self: flex-start;
  z-index: var(--z-sticky);
}

.div-sticky {
  position: sticky;
  height: auto;
  z-index: var(--z-sticky);
}

.top-60 {
  top: 60px;
}

.z-index-max {
  z-index: 999999 !important;
}

.input-color-primary .v-field {
  background: rgb(var(--v-theme-primary));
  color: rgb(var(--v-theme-tertiary));
}

.limit-max-width-xl {
  max-width: 1400px !important;
  margin: 0 auto;
}

/* ===== DESIGN SYSTEM COMPONENTS ===== */

/* Modern Cards */
.modern-card {
  border-radius: var(--radius-lg);
  background: rgb(var(--v-theme-surface));
  border: 1px solid rgb(var(--v-theme-outline));
  box-shadow: var(--shadow-md);
  transition: var(--transition-normal);
}

.modern-card:hover {
  box-shadow: var(--shadow-lg);
  transform: translateY(-2px);
}

/* Glassmorphism Cards */
.glass-card {
  border-radius: var(--radius-lg);
  background: rgba(var(--v-theme-surface), 0.95);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(var(--v-theme-outline), 0.2);
  box-shadow: var(--shadow-lg);
}

/* Gradient Cards */
.gradient-card {
  border-radius: var(--radius-lg);
  background: linear-gradient(
    135deg,
    rgb(var(--v-theme-primary)) 0%,
    rgb(var(--v-theme-accent)) 100%
  );
  color: rgb(var(--v-theme-onPrimary));
  box-shadow: var(--shadow-lg);
}

/* Global Button Styles */
.v-btn {
  border-radius: 12px !important;
}

/* Modern Buttons */
.modern-btn {
  border-radius: 12px !important;
  text-transform: none !important;
  font-weight: var(--font-weight-medium) !important;
  box-shadow: var(--shadow-sm) !important;
  transition: var(--transition-normal) !important;
}

.modern-btn:hover {
  transform: translateY(-1px) !important;
  box-shadow: var(--shadow-md) !important;
}

.modern-btn-primary {
  background: linear-gradient(
    135deg,
    rgb(var(--v-theme-primary)) 0%,
    rgb(var(--v-theme-accent)) 100%
  ) !important;
  color: rgb(var(--v-theme-onPrimary)) !important;
  box-shadow: 0 4px 12px rgba(var(--v-theme-primary), 0.3) !important;
}

.modern-btn-primary:hover {
  box-shadow: 0 6px 16px rgba(var(--v-theme-primary), 0.4) !important;
}

.modern-btn-success {
  background: linear-gradient(
    135deg,
    rgb(var(--v-theme-success)) 0%,
    rgb(var(--v-theme-success)) 100%
  ) !important;
  color: rgb(var(--v-theme-onSuccess)) !important;
  box-shadow: 0 4px 12px rgba(var(--v-theme-success), 0.3) !important;
}

.modern-btn-success:hover {
  box-shadow: 0 6px 16px rgba(var(--v-theme-success), 0.4) !important;
}

.modern-btn-whatsapp {
  background: linear-gradient(135deg, #25d366 0%, #128c7e 100%) !important;
  color: white !important;
  box-shadow: 0 4px 12px rgba(37, 211, 102, 0.3) !important;
}

.modern-btn-whatsapp:hover {
  box-shadow: 0 6px 16px rgba(37, 211, 102, 0.4) !important;
}

/* Modern Input Fields */
.modern-input .v-field {
  border-radius: var(--radius-md);
  background: rgb(var(--v-theme-surfaceVariant));
  border: 1px solid rgb(var(--v-theme-outline));
  transition: var(--transition-fast);
}

.modern-input .v-field:focus-within {
  border-color: rgb(var(--v-theme-primary));
  box-shadow: 0 0 0 3px rgba(var(--v-theme-primary), 0.1);
}

/* Modern Icons */
.modern-icon {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-sm);
  background: linear-gradient(
    135deg,
    rgb(var(--v-theme-primary)) 0%,
    rgb(var(--v-theme-accent)) 100%
  );
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgb(var(--v-theme-onPrimary));
}

/* Loading States */
.modern-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-2xl);
}

.modern-loading-icon {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: linear-gradient(
    135deg,
    rgb(var(--v-theme-primary)) 0%,
    rgb(var(--v-theme-accent)) 100%
  );
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgb(var(--v-theme-onPrimary));
}

/* Error States */
.modern-error {
  text-align: center;
  padding: var(--space-2xl);
}

.modern-error-icon {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: linear-gradient(135deg, rgb(var(--v-theme-error)) 0%, rgb(var(--v-theme-error)) 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto var(--space-lg);
  color: rgb(var(--v-theme-onError));
}

/* Success States */
.modern-success {
  text-align: center;
  padding: var(--space-2xl);
}

.modern-success-icon {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: linear-gradient(
    135deg,
    rgb(var(--v-theme-success)) 0%,
    rgb(var(--v-theme-success)) 100%
  );
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto var(--space-lg);
  color: rgb(var(--v-theme-onSuccess));
}

/* Typography Classes */
.text-primary {
  color: rgb(var(--v-theme-primary)) !important;
}

.text-secondary {
  color: rgb(var(--v-theme-secondary)) !important;
}

.text-light {
  color: rgb(var(--v-theme-onSurfaceVariant)) !important;
}

.text-white {
  color: rgb(var(--v-theme-onPrimary)) !important;
}

/* Force Poppins font for all text classes */
[class*='text-'] {
  font-family: 'Poppins', sans-serif !important;
}

/* Specific text classes with Poppins */
.text-h1,
.text-h2,
.text-h3,
.text-h4,
.text-h5,
.text-h6,
.text-body-1,
.text-body-2,
.text-body-3,
.text-subtitle-1,
.text-subtitle-2,
.text-caption,
.text-overline {
  font-family: 'Poppins', sans-serif !important;
}

.font-light {
  font-weight: var(--font-weight-light) !important;
}

.font-normal {
  font-weight: var(--font-weight-normal) !important;
}

.font-medium {
  font-weight: var(--font-weight-medium) !important;
}

.font-semibold {
  font-weight: var(--font-weight-semibold) !important;
}

.font-bold {
  font-weight: var(--font-weight-bold) !important;
}

/* Remove underlines from links */
a[href^='mailto:'],
a[href^='http'],
a[href^='https'],
a[href^='tel:'] {
  text-decoration: none !important;
}

a[href^='mailto:']:hover,
a[href^='http']:hover,
a[href^='https']:hover,
a[href^='tel:']:hover {
  text-decoration: underline !important;
}

/* Spacing Classes */
.p-xs {
  padding: var(--space-xs) !important;
}

.p-sm {
  padding: var(--space-sm) !important;
}

.p-md {
  padding: var(--space-md) !important;
}

.p-lg {
  padding: var(--space-lg) !important;
}

.p-xl {
  padding: var(--space-xl) !important;
}

.m-xs {
  margin: var(--space-xs) !important;
}

.m-sm {
  margin: var(--space-sm) !important;
}

.m-md {
  margin: var(--space-md) !important;
}

.m-lg {
  margin: var(--space-lg) !important;
}

.m-xl {
  margin: var(--space-xl) !important;
}

/* Background Classes */
.bg-primary {
  background: rgb(var(--v-theme-primary)) !important;
}

.bg-secondary {
  background: rgb(var(--v-theme-secondary)) !important;
}

.bg-surface {
  background: rgb(var(--v-theme-surface)) !important;
}

.bg-surface-variant {
  background: rgb(var(--v-theme-surfaceVariant)) !important;
}

.bg-gradient {
  background: linear-gradient(
    135deg,
    rgb(var(--v-theme-primary)) 0%,
    rgb(var(--v-theme-accent)) 100%
  ) !important;
}

/* Border Radius Classes */
.rounded-sm {
  border-radius: var(--radius-sm) !important;
}

.rounded-md {
  border-radius: var(--radius-md) !important;
}

.rounded-lg {
  border-radius: var(--radius-lg) !important;
}

/* Shadow Classes */
.shadow-sm {
  box-shadow: var(--shadow-sm) !important;
}

.shadow-md {
  box-shadow: var(--shadow-md) !important;
}

.shadow-lg {
  box-shadow: var(--shadow-lg) !important;
}

/* ===== RESPONSIVE DESIGN ===== */
@media (max-width: 768px) {
  :root {
    --space-xl: 24px;
    --space-2xl: 32px;
    --space-3xl: 40px;
    --space-4xl: 48px;
  }

  .modern-card {
    border-radius: var(--radius-md);
  }

  .modern-btn {
    border-radius: var(--radius-sm) !important;
  }
}

/* ===== ANIMATIONS ===== */
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes slideIn {
  from {
    transform: translateX(-100%);
  }
  to {
    transform: translateX(0);
  }
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
}

.fade-in {
  animation: fadeIn 0.5s ease-out;
}

.slide-in {
  animation: slideIn 0.3s ease-out;
}

.pulse {
  animation: pulse 2s infinite;
}

/* ===== ACCESSIBILITY ===== */
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}

/* Focus styles for accessibility */
.modern-btn:focus,
.modern-input .v-field:focus-within {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 2px;
}

/* High contrast mode support */
@media (prefers-contrast: high) {
  :root {
    --text-primary: #000000;
    --text-secondary: #333333;
    --bg-primary: rgb(var(--v-theme-surface));
    --bg-secondary: rgb(var(--v-theme-surfaceVariant));
  }
}
</style>
