import React, { useState, useRef, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Camera, Upload, ZoomIn, ZoomOut, RotateCcw, Save, Loader2, Check } from "lucide-react";
import { toast } from "react-hot-toast";

/**
 * ProfilePictureModal
 *
 * Props:
 *   isOpen        - boolean
 *   onClose       - fn()
 *   uploadUrl     - string  (POST endpoint)
 *   fetchUrl      - string  (GET endpoint for preview)
 *   authToken     - string  (Bearer token)
 *   userName      - string  (shown in modal)
 *   onSuccess     - fn()    (called after successful save)
 *   isAdmin       - boolean (true -> sends JSON base64; false -> multipart form)
 */
const ProfilePictureModal = ({
  isOpen,
  onClose,
  uploadUrl,
  fetchUrl,
  authToken,
  userName = "User",
  onSuccess,
  isAdmin = false,
}) => {
  const fileInputRef = useRef(null);
  const canvasRef = useRef(null);

  const [step, setStep] = useState("preview"); // "preview" | "crop"
  const [rawImage, setRawImage] = useState(null);
  const [croppedBlob, setCroppedBlob] = useState(null);
  const [croppedPreview, setCroppedPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [currentPicUrl, setCurrentPicUrl] = useState(null);
  const [currentPicFailed, setCurrentPicFailed] = useState(false);

  // Crop state
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imageEl, setImageEl] = useState(null);

  // Responsive canvas size: 220px is compact and fits all mobile and small screens
  const CANVAS_SIZE = 220;

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && fetchUrl) {
      setCurrentPicUrl(`${fetchUrl}?t=${Date.now()}`);
      setCurrentPicFailed(false);
    }
    if (!isOpen) {
      setStep("preview");
      setRawImage(null);
      setCroppedBlob(null);
      setCroppedPreview(null);
      setScale(1);
      setOffset({ x: 0, y: 0 });
      setImageEl(null);
      setCurrentPicFailed(false);
    }
  }, [isOpen, fetchUrl]);

  const draw = useCallback((ctx, img, sc, off, size) => {
    ctx.clearRect(0, 0, size, size);
    ctx.drawImage(img, off.x, off.y, img.naturalWidth * sc, img.naturalHeight * sc);

    // Darken ONLY outside the circle (image inside circle stays fully opaque)
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, size, size);                                          // outer rect
    ctx.arc(size / 2, size / 2, size / 2 - 3, 0, Math.PI * 2, true);  // circle hole (CCW)
    ctx.fillStyle = "rgba(0, 0, 0, 0.58)";
    ctx.fill("evenodd");  // fills only the area between rect and circle
    ctx.restore();

    // Circle border
    ctx.strokeStyle = "rgba(0, 180, 235, 0.95)";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - 3, 0, Math.PI * 2);
    ctx.stroke();
  }, []);

  const redraw = useCallback((newScale, newOffset) => {
    const canvas = canvasRef.current;
    if (!canvas || !imageEl) return;
    draw(canvas.getContext("2d"), imageEl, newScale, newOffset, canvas.width);
  }, [imageEl, draw]);

  useEffect(() => {
    if (step !== "crop" || !rawImage || !imageEl) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    draw(canvas.getContext("2d"), imageEl, scale, offset, canvas.width);
  }, [step, rawImage, imageEl, scale, offset, draw]);

  const onPointerDown = (e) => {
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
    setIsDragging(true);
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  };

  const onPointerMove = (e) => {
    if (!isDragging) return;
    e.preventDefault();
    const newOff = { x: e.clientX - dragStart.x, y: e.clientY - dragStart.y };
    setOffset(newOff);
    redraw(scale, newOff);
  };

  const onPointerUp = (e) => {
    if (isDragging) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}
      setIsDragging(false);
    }
  };

  const handleZoom = (delta) => {
    const newScale = Math.min(5, Math.max(0.05, scale + delta));
    setScale(newScale);
    redraw(newScale, offset);
  };

  const handleReset = () => {
    if (!imageEl) return;
    const fitScale = Math.min(CANVAS_SIZE / imageEl.naturalWidth, CANVAS_SIZE / imageEl.naturalHeight);
    const newOffset = {
      x: (CANVAS_SIZE - imageEl.naturalWidth * fitScale) / 2,
      y: (CANVAS_SIZE - imageEl.naturalHeight * fitScale) / 2,
    };
    setScale(fitScale);
    setOffset(newOffset);
    redraw(fitScale, newOffset);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select a valid image file");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      setRawImage(ev.target.result);
      const img = new Image();
      img.onload = () => {
        const fitScale = Math.min(CANVAS_SIZE / img.naturalWidth, CANVAS_SIZE / img.naturalHeight);
        const initOffset = {
          x: (CANVAS_SIZE - img.naturalWidth * fitScale) / 2,
          y: (CANVAS_SIZE - img.naturalHeight * fitScale) / 2,
        };
        setScale(fitScale);
        setOffset(initOffset);
        setImageEl(img);
        setStep("crop");
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleApplyCrop = async () => {
    const CROP_OUTPUT_SIZE = 400;
    const ratio = CROP_OUTPUT_SIZE / CANVAS_SIZE;
    const offscreen = document.createElement("canvas");
    offscreen.width = CROP_OUTPUT_SIZE;
    offscreen.height = CROP_OUTPUT_SIZE;
    const ctx = offscreen.getContext("2d");

    // White background for PNG transparency
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, CROP_OUTPUT_SIZE, CROP_OUTPUT_SIZE);

    if (imageEl) {
      ctx.drawImage(
        imageEl,
        offset.x * ratio,
        offset.y * ratio,
        imageEl.naturalWidth * scale * ratio,
        imageEl.naturalHeight * scale * ratio
      );
    }

    offscreen.toBlob(
      (blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        setCroppedBlob(blob);
        setCroppedPreview(url);
        setStep("preview");
      },
      "image/jpeg",
      0.92
    );
  };

  const handleSave = async () => {
    if (!croppedBlob) {
      toast.error("Please select and crop an image first");
      return;
    }
    if (!uploadUrl) {
      toast.error("Could not determine upload endpoint. Please try refreshing.");
      return;
    }

    setUploading(true);
    try {
      const headers = {};
      if (authToken) {
        headers["Authorization"] = `Bearer ${authToken}`;
      }

      let resp;
      if (isAdmin) {
        const reader = new FileReader();
        const base64 = await new Promise((res) => {
          reader.onload = (e) => res(e.target.result);
          reader.readAsDataURL(croppedBlob);
        });
        resp = await fetch(uploadUrl, {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({ imageBase64: base64 }),
        });
      } else {
        const formData = new FormData();
        formData.append("image", croppedBlob, "profile.jpg");
        resp = await fetch(uploadUrl, {
          method: "POST",
          headers,
          body: formData,
        });
      }

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.error || errData.message || "Upload failed");
      }

      toast.success("Profile picture updated!");
      setCurrentPicUrl(`${fetchUrl}?t=${Date.now()}`);
      setCroppedBlob(null);
      setCroppedPreview(null);
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      console.error("Upload error:", err);
      toast.error(err.message || "Failed to upload profile picture");
    } finally {
      setUploading(false);
    }
  };

  if (!isOpen) return null;

  const isCollapsed = (() => {
    try {
      return JSON.parse(localStorage.getItem("isSidebarCollapsed") || "false");
    } catch {
      return false;
    }
  })();

  const dialogCard = (
    <div
      className="relative bg-white rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-[360px] max-h-[90vh] overflow-hidden flex flex-col z-10 animate-in fade-in zoom-in-95 duration-200 pointer-events-auto my-auto border border-slate-100"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Compact Header */}
      <div className="h-16 sm:h-20 bg-gradient-to-br from-[#000066] via-[#003399] to-[#006600] relative flex-shrink-0">
        <button
          onClick={onClose}
          className="absolute top-2.5 right-2.5 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-full p-1.5 transition-colors cursor-pointer"
          title="Close"
        >
          <X className="h-4 w-4" />
        </button>
        {/* Avatar circle positioned at header bottom */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2">
          <div className="relative">
            <div className="w-16 h-16 rounded-full border-3 border-white shadow-lg overflow-hidden bg-gradient-to-br from-[#000066] to-[#00b4eb] flex items-center justify-center">
              {croppedPreview ? (
                <img src={croppedPreview} alt="Preview" className="w-full h-full object-cover" />
              ) : currentPicUrl && !currentPicFailed ? (
                <img
                  src={currentPicUrl}
                  alt="Current"
                  className="w-full h-full object-cover"
                  onError={() => setCurrentPicFailed(true)}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white font-bold text-xl">
                  {userName ? userName.charAt(0).toUpperCase() : "U"}
                </div>
              )}
            </div>
            <label
              htmlFor="profile-pic-input-modal"
              className="absolute -bottom-0.5 -right-0.5 w-6 h-6 bg-[#00b4eb] hover:bg-[#0092c2] rounded-full border-2 border-white flex items-center justify-center cursor-pointer transition-colors shadow"
              title="Choose photo"
            >
              <Camera className="h-3 w-3 text-white" />
            </label>
          </div>
        </div>
      </div>

      <input
        id="profile-pic-input-modal"
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Scrollable Body Content */}
      <div className="pt-10 px-4 pb-4 sm:pt-11 sm:px-6 sm:pb-5 overflow-y-auto flex-1 flex flex-col">
        <h3 className="text-center text-base sm:text-lg font-bold text-slate-800 mb-0.5">
          Profile Picture
        </h3>
        <p className="text-center text-xs text-slate-400 mb-3 truncate">{userName}</p>

        {step === "preview" && (
          <div className="flex flex-col gap-2.5">
            {croppedPreview && (
              <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
                <div className="w-7 h-7 rounded-full overflow-hidden border border-emerald-300 flex-shrink-0">
                  <img src={croppedPreview} className="w-full h-full object-cover" alt="" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-semibold text-emerald-700 block leading-tight">
                    Cropped &amp; ready to save
                  </span>
                  <span className="text-[10px] text-emerald-600 block leading-tight truncate">
                    Click save below to update
                  </span>
                </div>
                <Check className="h-4 w-4 text-emerald-600 flex-shrink-0" />
              </div>
            )}
            <label
              htmlFor="profile-pic-input-modal"
              className="w-full py-2.5 rounded-xl flex items-center justify-center gap-2 font-bold text-xs sm:text-sm bg-gradient-to-r from-[#000066] to-[#006600] text-white cursor-pointer hover:opacity-90 transition-opacity shadow-sm"
            >
              <Upload className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              {croppedPreview ? "Choose Different Photo" : "Choose Photo"}
            </label>
            {croppedBlob && (
              <button
                onClick={handleSave}
                disabled={uploading}
                className="w-full py-2.5 rounded-xl flex items-center justify-center gap-2 font-bold text-xs sm:text-sm bg-emerald-600 hover:bg-emerald-700 text-white transition-colors shadow-sm disabled:opacity-60 cursor-pointer"
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Save Profile Picture
                  </>
                )}
              </button>
            )}
          </div>
        )}

        {step === "crop" && (
          <div className="flex flex-col items-center gap-2">
            <p className="text-[11px] text-slate-500 text-center leading-tight">
              Drag to reposition &middot; Zoom or scroll to fit
            </p>
            <div
              className="relative rounded-full overflow-hidden shadow-lg border-2 border-[#00b4eb]/50 select-none touch-none mx-auto flex-shrink-0"
              style={{ width: CANVAS_SIZE, height: CANVAS_SIZE }}
            >
              <canvas
                ref={canvasRef}
                width={CANVAS_SIZE}
                height={CANVAS_SIZE}
                className="cursor-grab active:cursor-grabbing select-none block"
                style={{ touchAction: "none", width: CANVAS_SIZE, height: CANVAS_SIZE }}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onWheel={(e) => {
                  e.preventDefault();
                  handleZoom(e.deltaY < 0 ? 0.06 : -0.06);
                }}
              />
            </div>
            {/* Zoom row */}
            <div className="flex items-center gap-1.5 w-full pt-0.5">
              <button
                onClick={() => handleZoom(-0.08)}
                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors flex-shrink-0 cursor-pointer"
                title="Zoom Out"
              >
                <ZoomOut className="h-3.5 w-3.5" />
              </button>
              <input
                type="range"
                min="0.05"
                max="4"
                step="0.02"
                value={scale}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  setScale(v);
                  redraw(v, offset);
                }}
                className="flex-1 accent-[#00b4eb] h-1.5 cursor-pointer"
              />
              <button
                onClick={() => handleZoom(0.08)}
                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors flex-shrink-0 cursor-pointer"
                title="Zoom In"
              >
                <ZoomIn className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={handleReset}
                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors flex-shrink-0 cursor-pointer"
                title="Reset Fit"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            </div>
            {/* Action buttons */}
            <div className="flex gap-2 w-full pt-1">
              <button
                onClick={() => setStep("preview")}
                className="flex-1 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold text-xs sm:text-sm hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Back
              </button>
              <button
                onClick={handleApplyCrop}
                className="flex-1 py-2 rounded-xl bg-[#00b4eb] text-white font-bold text-xs sm:text-sm hover:bg-[#0092c2] transition-colors shadow-sm cursor-pointer"
              >
                Apply Crop
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // Admin side: NO portal — renders directly in Layout DOM (same stacking context as navbar z-30 and footer z-30).
  // This means backdrop z-[20] is naturally below navbar and footer, so they are NOT blurred.
  // Intern side: portal to body so it covers everything including their navbar/sidebar.
  // Click catcher: fixed inset-0 z-[49] | Wrapper: z-[50]
  const modalContent = isAdmin ? (
    <>
      {/* ── Backdrop: z-[20] — in same stacking context as Layout, so navbar z-30 and footer z-30 naturally sit above it ── */}
      <div
        className="fixed inset-0 z-[20] pointer-events-none bg-slate-900/60 backdrop-blur-md transition-all duration-300"
        aria-hidden="true"
      />

      {/* ── Click-outside backdrop layer (z-[49]) ── */}
      <div
        className="fixed inset-0 z-[49] pointer-events-auto"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* ── Positioning wrapper: aligned exactly like the security check popup (z-[50]) ── */}
      <div
        className={`fixed left-0 ${
          isCollapsed ? "lg:left-[72px]" : "lg:left-[260px]"
        } right-0 bottom-0 top-[64px] z-[50] pointer-events-none flex flex-col items-center justify-center px-4 pt-6 pb-[80px] lg:pb-8 overflow-y-auto`}
      >
        {dialogCard}
      </div>
    </>
  ) : (
    <div className="fixed inset-0 z-[9999] pointer-events-none">
      {/* Full-screen backdrop covering everything on intern side */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-md transition-all duration-300 pointer-events-auto"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Positioning wrapper: full-screen centered on intern side */}
      <div className="fixed inset-0 z-[10000] p-3 sm:p-4 pointer-events-none flex flex-col items-center justify-center overflow-y-auto">
        {dialogCard}
      </div>
    </div>
  );

  // Admin side: render WITHOUT portal so it shares the Layout's stacking context.
  // This way backdrop z-[20] is below navbar z-30 and footer z-30 (same context) → they stay unblurred.
  // Intern side: render with portal to document.body so it covers everything at z-[9999].
  if (isAdmin) {
    return modalContent;
  }

  return typeof document !== "undefined" ? createPortal(modalContent, document.body) : null;
};

export default ProfilePictureModal;
