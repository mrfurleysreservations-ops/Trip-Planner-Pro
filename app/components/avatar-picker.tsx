"use client";
import { useState, useRef, useEffect } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

interface AvatarPickerProps {
  currentUrl: string | null;
  fallbackEmoji: string;
  size?: number;
  storagePath: string;
  onUploaded: (publicUrl: string) => void;
  onError?: (message: string) => void;
}

export default function AvatarPicker({ currentUrl, fallbackEmoji, size = 80, storagePath, onUploaded, onError }: AvatarPickerProps) {
  const [showLightbox, setShowLightbox] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [localUrl, setLocalUrl] = useState<string | null>(currentUrl);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createBrowserSupabaseClient();

  // Sync localUrl when parent passes a new currentUrl
  useEffect(() => {
    setLocalUrl(currentUrl);
  }, [currentUrl]);

  const openFilePicker = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadError(null);
    try {
      const ext = file.name.split(".").pop();
      const filePath = `${storagePath}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("avatars").upload(filePath, file, { upsert: true });
      if (error) {
        const msg = `Upload failed: ${error.message}`;
        setUploadError(msg);
        onError?.(msg);
        console.error("Avatar upload failed:", error);
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }

      const { data } = supabase.storage.from("avatars").getPublicUrl(filePath);
      const publicUrl = data.publicUrl;

      setLocalUrl(publicUrl);
      onUploaded(publicUrl);
      setShowLightbox(false);
      setUploadError(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      setUploadError(msg);
      onError?.(msg);
      console.error("Avatar upload failed:", err);
    } finally {
      setUploading(false);
      // Reset input so the same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleAvatarClick = () => {
    if (localUrl) {
      setShowLightbox(true);
    } else {
      openFilePicker();
    }
  };

  const handleCameraClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    openFilePicker();
  };

  return (
    <>
      <div
        onClick={handleAvatarClick}
        style={{ position: "relative", cursor: "pointer", width: size, height: size, flexShrink: 0 }}
      >
        {localUrl ? (
          <img
            src={localUrl}
            alt="Avatar"
            width={size}
            height={size}
            style={{
              borderRadius: "50%",
              objectFit: "cover",
              border: "3px solid #e8943a",
              opacity: uploading ? 0.5 : 1,
              transition: "opacity 0.2s",
              width: size,
              height: size,
            }}
          />
        ) : (
          <div
            style={{
              width: size,
              height: size,
              borderRadius: "50%",
              background: "#f0f0f0",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: size * 0.45,
              border: "3px solid #e8943a",
              opacity: uploading ? 0.5 : 1,
              transition: "opacity 0.2s",
            }}
          >
            {fallbackEmoji}
          </div>
        )}

        {/* Camera icon overlay */}
        <div
          onClick={handleCameraClick}
          style={{
            position: "absolute",
            bottom: 0,
            right: 0,
            width: 28,
            height: 28,
            borderRadius: "50%",
            background: "#e8943a",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "14px",
            cursor: "pointer",
            border: "2px solid #fff",
            boxShadow: "0 1px 4px rgba(0,0,0,0.15)",
          }}
        >
          📷
        </div>

        {uploading && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(255,255,255,0.4)",
              fontSize: size * 0.25,
            }}
          >
            ⏳
          </div>
        )}
        {uploadError && !uploading && (
          <div
            title={uploadError}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: 20,
              height: 20,
              borderRadius: "50%",
              background: "#e74c3c",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "12px",
              fontWeight: 700,
              border: "2px solid #fff",
              cursor: "help",
            }}
          >
            !
          </div>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleFileChange}
      />

      {/* Lightbox overlay */}
      {showLightbox && localUrl && (
        <div
          onClick={() => setShowLightbox(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            background: "rgba(0,0,0,0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
            gap: "16px",
          }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
            <img
              src={localUrl}
              alt="Avatar full size"
              style={{
                maxWidth: "90vw",
                maxHeight: "80vh",
                borderRadius: "12px",
                objectFit: "contain",
              }}
            />
            <div style={{ display: "flex", gap: "12px" }}>
              <button
                className="btn"
                onClick={() => openFilePicker()}
                style={{ background: "#e8943a", color: "#fff", padding: "10px 20px", borderRadius: "8px", fontWeight: 600 }}
              >
                Change Photo
              </button>
              <button
                className="btn"
                onClick={() => setShowLightbox(false)}
                style={{ background: "rgba(255,255,255,0.2)", color: "#fff", padding: "10px 20px", borderRadius: "8px", fontWeight: 600 }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
