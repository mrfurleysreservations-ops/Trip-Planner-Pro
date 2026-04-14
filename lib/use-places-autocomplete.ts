import { useRef, useEffect, useCallback } from "react";

/**
 * Hook that attaches Google Places Autocomplete to an input element.
 * Uses a callback ref so it works with conditionally rendered inputs
 * (e.g., forms that mount/unmount). Gracefully degrades to a plain
 * text input if the Google Maps script hasn't loaded or no API key
 * is configured.
 */
export function usePlacesAutocomplete(
  onSelect: (place: string) => void,
  options?: { types?: string[] },
) {
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const inputElRef = useRef<HTMLInputElement | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const typesRef = useRef(options?.types ?? ["(cities)"]);

  const attach = useCallback((input: HTMLInputElement) => {
    if (typeof google === "undefined" || !google.maps?.places) return false;

    const ac = new google.maps.places.Autocomplete(input, {
      types: typesRef.current,
      fields: ["formatted_address", "name"],
    });

    ac.addListener("place_changed", () => {
      const place = ac.getPlace();
      const value = place?.formatted_address || place?.name || "";
      if (value) onSelectRef.current(value);
    });

    autocompleteRef.current = ac;
    return true;
  }, []);

  // Callback ref — fires every time the input mounts or unmounts
  const callbackRef = useCallback((node: HTMLInputElement | null) => {
    // Cleanup previous instance if the input unmounts or changes
    if (autocompleteRef.current && inputElRef.current && node !== inputElRef.current) {
      google.maps.event.clearInstanceListeners(autocompleteRef.current);
      autocompleteRef.current = null;
    }

    inputElRef.current = node;
    if (!node) return;

    // Try to attach immediately
    if (attach(node)) return;

    // Google not loaded yet — poll until it is
    const interval = setInterval(() => {
      if (!inputElRef.current || inputElRef.current !== node) {
        clearInterval(interval);
        return;
      }
      if (attach(node)) clearInterval(interval);
    }, 500);

    // Stop polling after 15s
    setTimeout(() => clearInterval(interval), 15000);
  }, [attach]);

  return callbackRef;
}
