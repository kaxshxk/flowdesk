"use client";

import React, { useEffect, useRef, useCallback } from "react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface GoogleSignButtonProps {
  /** Your Google OAuth 2.0 client ID from the Google Cloud Console. */
  clientId: string;
  /** Called with the raw OIDC ID‑token credential string on success. */
  onCredential: (credential: string) => Promise<void>;
  /** Visually disable the button while a sign-in exchange is in flight. */
  disabled?: boolean;
  /** Optional extra Tailwind classes for the wrapper. */
  className?: string;
}

/* ------------------------------------------------------------------ */
/*  Helper – load the GIS script once                                 */
/* ------------------------------------------------------------------ */

let scriptPromise: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const g = (window as any).google;
  if (g?.accounts) return Promise.resolve();
  /* eslint-enable @typescript-eslint/no-explicit-any */
  if (!scriptPromise) {
    scriptPromise = new Promise<void>((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://accounts.google.com/gsi/client";
      s.async = true;
      s.defer = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error("Failed to load Google Identity Services"));
      document.head.appendChild(s);
    });
  }
  return scriptPromise;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

/**
 * Custom Google Sign-In button powered by Google Identity Services (GIS).
 *
 * Instead of pulling in `@react-oauth/google` we load the GIS script
 * dynamically and render a fully styled button ourselves so we keep full
 * control over the visual design while still receiving the OIDC credential
 * callback from Google's `callback2` One Tap / Sign-in flow.
 */
export default function GoogleSignButton({
  clientId,
  onCredential,
  disabled = false,
  className = "",
}: GoogleSignButtonProps) {
  const buttonRef = useRef<HTMLDivElement>(null);
  const initializing = useRef(false);
  const googleInitialized = useRef(false);

  const initGoogle = useCallback(() => {
    if (initializing.current || googleInitialized.current || !buttonRef.current)
      return;
    initializing.current = true;

    loadScript()
      .then(() => {
        const g = (window as unknown as Record<string, any>).google;
        if (!g?.accounts?.id) {
          console.error("Google Identity Services not available after script load.");
          initializing.current = false;
          return;
        }

        g.accounts.id.initialize({
          client_id: clientId,
          callback: (response: { credential: string }) => {
            if (response.credential) {
              onCredential(response.credential);
            }
          },
          auto_select: false,
          cancel_on_tap_outside: true,
        });

        googleInitialized.current = true;
        initializing.current = false;
      })
      .catch((err) => {
        console.error(err);
        initializing.current = false;
      });
  }, [clientId, onCredential]);

  /* Load + initialise GIS on mount */
  useEffect(() => {
    initGoogle();
  }, [initGoogle]);

  /**
   * Trigger the Google One Tap moment or credential picker when
   * the user clicks our styled button.
   */
  const handleClick = () => {
    if (disabled || !googleInitialized.current) return;
    const g = (window as unknown as Record<string, any>).google;
    g?.accounts?.id.prompt((notification: { isNotDisplayed: () => boolean; isSkippedMoment: () => boolean }) => {
      if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
        // Fallback: render the classic popup-based Sign-In With Google
        g.accounts.id.renderButton(buttonRef.current, {
          theme: "outline",
          size: "large",
          text: "signin_with",
          shape: "rectangular",
          logo_alignment: "left",
        });
        // Auto-click the rendered button to open the Google account popup
        const renderedButton = buttonRef.current?.querySelector(
          "button[aria-label]"
        ) as HTMLButtonElement | null;
        renderedButton?.click();
      }
    });
  };

  return (
    <div className={`flex flex-col items-center ${className}`}>
      {/* Our custom-styled visible button */}
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled}
        className={`
          w-full flex items-center justify-center gap-3
          h-12 px-6 rounded-lg
          bg-white hover:bg-gray-50 active:bg-gray-100
          text-gray-700 font-medium text-sm
          border border-gray-300 shadow-sm
          transition-colors duration-150
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1
          disabled:opacity-60 disabled:cursor-not-allowed
          cursor-pointer
        `}
      >
        {/* Google "G" SVG */}
        <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24">
          <path
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z"
            fill="#4285F4"
          />
          <path
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23Z"
            fill="#34A853"
          />
          <path
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62Z"
            fill="#FBBC05"
          />
          <path
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53Z"
            fill="#EA4335"
          />
        </svg>
        <span>Sign in with Google</span>
      </button>

      {/* Hidden container for GIS renderButton fallback */}
      <div ref={buttonRef} className="hidden" />
    </div>
  );
}
