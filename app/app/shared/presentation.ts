/**
 * Temporary presentation switch.
 * Set to false before exposing the app outside the boss/demo presentation.
 */
export const PRESENTATION_MODE = true;

export const PRESENTATION_USER = {
  id: 1,
  openId: "presentation-demo-user",
  name: "NIGHTOPS Presentation",
  email: "presentation@nightops.local",
  loginMethod: "presentation",
  role: "admin" as const,
  createdAt: new Date(0),
  updatedAt: new Date(0),
  lastSignedIn: new Date(),
};
