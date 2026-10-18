export type BusinessProfile = {
  name: string;
  businessName: string;
  ownerFirstName: string;
  ownerSecondName: string;
  email: string;
  contactNumber: string;
  gender: string;
};

export const BUSINESS_PROFILE_STORAGE_KEY = "solexa-business-profile";

export const defaultBusinessProfile: BusinessProfile = {
  name: "Solexa by Intellisense",
  businessName: "Solexa by Intellisense",
  ownerFirstName: "Minaal",
  ownerSecondName: "Rizwan",
  email: "",
  contactNumber: "",
  gender: "",
};

export function readBusinessProfile() {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem(BUSINESS_PROFILE_STORAGE_KEY);
    if (!stored) return null;
    return { ...defaultBusinessProfile, ...JSON.parse(stored) } as BusinessProfile;
  } catch {
    return null;
  }
}

export function hasCompletedOnboarding(profile: BusinessProfile | null) {
  return Boolean(profile?.businessName?.trim() && profile.ownerFirstName?.trim() && profile.ownerSecondName?.trim() && profile.email?.trim() && profile.contactNumber?.trim() && profile.gender?.trim());
}

export function getOwnerDisplayName(profile: BusinessProfile | null) {
  const name = [profile?.ownerFirstName, profile?.ownerSecondName].filter((part) => part?.trim()).join(" ").trim();
  return name || "Minaal Rizwan";
}
