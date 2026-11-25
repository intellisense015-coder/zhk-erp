export type BusinessProfile = {
  name: string;
  businessName: string;
  ownerFirstName: string;
  ownerSecondName: string;
  email: string;
  contactNumber: string;
  gender: string;
};

export const defaultBusinessProfile: BusinessProfile = {
  name: "Solexa by Intellisense",
  businessName: "Solexa by Intellisense",
  ownerFirstName: "Minaal",
  ownerSecondName: "Rizwan",
  email: "",
  contactNumber: "",
  gender: "",
};

/**
 * Business identity is authoritative in Supabase. Never restore it from a
 * browser cache or treat legacy PIN state as an authentication signal.
 */
export function readBusinessProfile() {
  return null;
}

export function hasCompletedOnboarding(profile: BusinessProfile | null) {
  return Boolean(profile?.businessName?.trim() && profile.ownerFirstName?.trim() && profile.ownerSecondName?.trim() && profile.email?.trim() && profile.contactNumber?.trim() && profile.gender?.trim());
}

export function getOwnerDisplayName(profile: BusinessProfile | null) {
  const name = [profile?.ownerFirstName, profile?.ownerSecondName].filter((part) => part?.trim()).join(" ").trim();
  return name || "Minaal Rizwan";
}
