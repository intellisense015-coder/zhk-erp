"use client";

import { ArrowLeft, ArrowRight, Building2, CheckCircle2, UserRound } from "lucide-react";
import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Button } from "../../../components/primitives/button";
import { ThemeToggle } from "../../../components/auth/auth-shell";
import { Field, SelectField } from "../../../components/primitives/primitives";
import {
  BUSINESS_PROFILE_STORAGE_KEY,
  defaultBusinessProfile,
  readBusinessProfile,
  type BusinessProfile,
} from "../../../lib/business-profile";
import styles from "./onboarding.module.css";

type OnboardingDraft = Pick<
  BusinessProfile,
  | "businessName"
  | "ownerFirstName"
  | "ownerSecondName"
  | "email"
  | "contactNumber"
  | "gender"
>;
type FieldErrors = Partial<Record<keyof OnboardingDraft, string>>;

const emptyDraft: OnboardingDraft = {
  businessName: "",
  ownerFirstName: "",
  ownerSecondName: "",
  email: "",
  contactNumber: "",
  gender: "",
};

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<OnboardingDraft>(emptyDraft);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const profile = readBusinessProfile();
    if (!profile) return;

    const frame = window.requestAnimationFrame(() => {
      setDraft({
        businessName: profile.businessName || profile.name || "",
        ownerFirstName: profile.ownerFirstName || "",
        ownerSecondName: profile.ownerSecondName || "",
        email: profile.email || "",
        contactNumber: profile.contactNumber || "",
        gender: profile.gender || "",
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  const update = (field: keyof OnboardingDraft, value: string) => {
    setDraft((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const validateStep = (currentStep: number) => {
    const nextErrors: FieldErrors = {};

    if (currentStep === 1) {
      if (!draft.businessName.trim()) {
        nextErrors.businessName = "Business name is required.";
      }
      if (!draft.ownerFirstName.trim()) {
        nextErrors.ownerFirstName = "Owner first name is required.";
      }
      if (!draft.ownerSecondName.trim()) {
        nextErrors.ownerSecondName = "Owner second name is required.";
      }
    } else {
      if (!/^\S+@\S+\.\S+$/.test(draft.email.trim())) {
        nextErrors.email = "Enter a valid email address.";
      }
      if (!/^[+()\d\s-]{7,}$/.test(draft.contactNumber.trim())) {
        nextErrors.contactNumber = "Enter a valid contact number.";
      }
      if (!draft.gender) {
        nextErrors.gender = "Gender is required.";
      }
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validateStep(step)) return;

    if (step === 1) {
      setStep(2);
      return;
    }

    setSaving(true);
    const profile: BusinessProfile = {
      ...defaultBusinessProfile,
      ...draft,
      name: draft.businessName.trim(),
      businessName: draft.businessName.trim(),
      ownerFirstName: draft.ownerFirstName.trim(),
      ownerSecondName: draft.ownerSecondName.trim(),
      email: draft.email.trim(),
      contactNumber: draft.contactNumber.trim(),
      gender: draft.gender,
    };

    window.localStorage.setItem(BUSINESS_PROFILE_STORAGE_KEY, JSON.stringify(profile));
    window.setTimeout(() => router.replace("/dashboard"), 300);
  };

  return (
    <main className={styles.page}>
      <ThemeToggle />
      <div className={styles.shell}>
        <div className={styles.intro}>
          <div className={styles.icon}>
            <Building2 size={19} />
          </div>
          <h1 className={styles.title}>Set up your workspace</h1>
          <p className={styles.description}>
            Tell us about your business and its owner so Solexa can personalize your workspace.
          </p>
          <div className={styles.stepper} aria-label={`Onboarding step ${step} of 2`}>
            <span className={`${styles.step} ${step >= 1 ? styles.active : ""}`}>
              <b>1</b>
              <small>Business</small>
            </span>
            <i className={`${styles.connector} ${step >= 2 ? styles.active : ""}`} />
            <span className={`${styles.step} ${step >= 2 ? styles.active : ""}`}>
              <b>2</b>
              <small>Owner</small>
            </span>
          </div>
        </div>

        <motion.section
          key={step}
          initial={{ opacity: 0, x: 18 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.35 }}
          className={styles.card}
        >
          <div className={styles.cardHeading}>
            <div>
              <h2>{step === 1 ? "Business details" : "Owner details"}</h2>
              <p>
                {step === 1
                  ? "These details identify your Solexa workspace."
                  : "These details help personalize your account."}
              </p>
            </div>
            <div className={styles.cardIcon}>
              {step === 1 ? <Building2 size={17} /> : <UserRound size={17} />}
            </div>
          </div>

          <form onSubmit={submit} noValidate className={styles.form}>
            {step === 1 ? (
              <div className={styles.fields}>
                <Field
                  label="Business name"
                  placeholder="e.g. Solexa Gadgets"
                  value={draft.businessName}
                  onChange={(event) => update("businessName", event.target.value)}
                  textOnly
                  hint={errors.businessName}
                  autoFocus
                />
                <div className={styles.twoColumn}>
                  <Field
                    label="Owner first name"
                    placeholder="e.g. Ali"
                    value={draft.ownerFirstName}
                    onChange={(event) => update("ownerFirstName", event.target.value)}
                    textOnly
                    hint={errors.ownerFirstName}
                  />
                  <Field
                    label="Owner second name"
                    placeholder="e.g. Asgher"
                    value={draft.ownerSecondName}
                    onChange={(event) => update("ownerSecondName", event.target.value)}
                    textOnly
                    hint={errors.ownerSecondName}
                  />
                </div>
              </div>
            ) : (
              <div className={styles.fields}>
                <Field
                  label="Email"
                  type="email"
                  placeholder="name@business.com"
                  value={draft.email}
                  onChange={(event) => update("email", event.target.value)}
                  hint={errors.email}
                  autoFocus
                />
                <div className={styles.twoColumn}>
                  <Field
                    label="Contact number"
                    type="tel"
                    placeholder="0300 1234567"
                    value={draft.contactNumber}
                    onChange={(event) => update("contactNumber", event.target.value)}
                    hint={errors.contactNumber}
                  />
                  <SelectField
                    label="Gender"
                    value={draft.gender}
                    hint={errors.gender}
                    onChange={(event) => update("gender", event.target.value)}
                  >
                    <option value="">Select gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                    <option value="Prefer not to say">Prefer not to say</option>
                  </SelectField>
                </div>
              </div>
            )}

            <div className={styles.actions}>
              {step === 2 ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setErrors({});
                    setStep(1);
                  }}
                >
                  <ArrowLeft size={14} />
                  Back
                </Button>
              ) : (
                <span />
              )}
              <Button type="submit" variant="brand" loading={saving}>
                {step === 1 ? (
                  <>
                    Continue <ArrowRight size={14} />
                  </>
                ) : (
                  <>
                    Complete setup <CheckCircle2 size={14} />
                  </>
                )}
              </Button>
            </div>
          </form>
        </motion.section>
      </div>
    </main>
  );
}
