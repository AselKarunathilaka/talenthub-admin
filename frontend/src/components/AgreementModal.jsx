import React, { useState, useMemo, useCallback, memo } from "react";
import {
  CalendarCheck,
  Clock,
  BookOpen,
  Video,
  Sparkles,
  Building2,
  LogOut,
  AlertTriangle,
  CheckCircle2,
  ShieldCheck,
  FileDown,
  CheckSquare,
  Square,
  ArrowRight,
  UserCheck,
  User,
  Mail,
  GraduationCap,
  Calendar,
  Layers,
  IdCard,
} from "lucide-react";
import { API_BASE_URL, API_ENDPOINTS } from "../api/apiConfig";
import agreementPdf from "../assets/Trainee_Guidelines_Agreement[34454]_251111_135146.pdf";

export const AGREEMENT_CLAUSES = [
  {
    id: "full_week_attendance",
    number: 1,
    title: "Full-Week Attendance",
    statement:
      "I agree to attend the workplace for all five working days of each week as required during my internship.",
    icon: CalendarCheck,
    tag: "Attendance",
    badgeBg: "bg-blue-50 text-blue-700 border-blue-200",
  },
  {
    id: "working_hours",
    number: 2,
    title: "Working Hours",
    statement:
      "I agree to work from 8:30 AM to 4:30 PM, Monday to Friday, during my internship.",
    icon: Clock,
    tag: "Schedule",
    badgeBg: "bg-indigo-50 text-indigo-700 border-indigo-200",
  },
  {
    id: "knowledge_sharing",
    number: 3,
    title: "Knowledge Sharing",
    statement:
      "I agree to actively participate in all required Knowledge Sharing sessions.",
    icon: BookOpen,
    tag: "Learning",
    badgeBg: "bg-purple-50 text-purple-700 border-purple-200",
  },
  {
    id: "meetings",
    number: 4,
    title: "Meetings",
    statement:
      "I agree to participate in both physical and online meetings as required during my internship.",
    icon: Video,
    tag: "Collaboration",
    badgeBg: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  {
    id: "dress_code",
    number: 5,
    title: "Dress Code",
    statement:
      "I agree to maintain a clean, appropriate, and professional appearance throughout my internship.",
    icon: Sparkles,
    tag: "Professionalism",
    badgeBg: "bg-amber-50 text-amber-700 border-amber-200",
  },
  {
    id: "workplace_cleanliness",
    number: 6,
    title: "Workplace Cleanliness",
    statement:
      "I agree to keep my work area clean and maintain a clean and professional workplace environment.",
    icon: Building2,
    tag: "Environment",
    badgeBg: "bg-teal-50 text-teal-700 border-teal-200",
  },
  {
    id: "early_leave",
    number: 7,
    title: "Early Leave",
    statement:
      "I agree to inform my supervisor and complete the required procedure whenever I need to leave the workplace early.",
    icon: LogOut,
    tag: "Protocol",
    badgeBg: "bg-sky-50 text-sky-700 border-sky-200",
  },
  {
    id: "internship_termination",
    number: 8,
    title: "Internship Termination",
    statement:
      "I acknowledge and agree that my internship may be terminated by my supervisor due to attendance issues or other valid reasons related to my internship performance or conduct.",
    icon: AlertTriangle,
    tag: "Policy",
    badgeBg: "bg-rose-50 text-rose-700 border-rose-200",
  },
];

// Memoized individual clause item for 0ms lag
const ClauseRow = memo(({ clause, isChecked, onToggle }) => {
  const IconComponent = clause.icon;

  return (
    <div
      onClick={() => onToggle(clause.id)}
      className={`group flex items-start sm:items-center justify-between gap-3 p-3 sm:p-3.5 rounded-xl border transition-colors duration-75 cursor-pointer select-none transform-gpu ${
        isChecked
          ? "bg-emerald-50/20 border-emerald-500 shadow-2xs ring-1 ring-emerald-500/20"
          : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/60"
      }`}
    >
      {/* Left: Number & Icon */}
      <div className="flex items-start sm:items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
        <div
          className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center border flex-shrink-0 transition-colors duration-75 mt-0.5 sm:mt-0 ${
            isChecked
              ? "bg-emerald-600 text-white border-emerald-600"
              : clause.badgeBg
          }`}
        >
          <IconComponent className="w-4 h-4" />
        </div>

        {/* Middle: Title & Statement */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              0{clause.number}
            </span>
            <h4 className="text-xs sm:text-sm font-bold text-slate-900">
              {clause.title}
            </h4>
            <span className="text-[10px] px-1.5 py-0.2 rounded font-medium bg-slate-100 text-slate-600">
              {clause.tag}
            </span>
          </div>
          <p
            className={`text-xs leading-relaxed ${
              isChecked ? "text-slate-800 font-medium" : "text-slate-600"
            }`}
          >
            "{clause.statement}"
          </p>
        </div>
      </div>

      {/* Right: Custom Checkbox */}
      <div className="flex items-center gap-2 flex-shrink-0 pl-1.5 pt-0.5 sm:pt-0">
        <div
          className={`w-5 h-5 sm:w-6 sm:h-6 rounded-md sm:rounded-lg flex items-center justify-center border transition-colors duration-75 ${
            isChecked
              ? "bg-emerald-600 border-emerald-600 text-white shadow-2xs"
              : "border-slate-300 bg-white group-hover:border-slate-400"
          }`}
        >
          {isChecked && <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
        </div>
      </div>
    </div>
  );
});

ClauseRow.displayName = "ClauseRow";

const AgreementModal = ({ onAccept, internName, internData }) => {
  const [checkedClauses, setCheckedClauses] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [profileImgError, setProfileImgError] = useState(false);

  const totalClauses = AGREEMENT_CLAUSES.length;

  const checkedCount = useMemo(() => {
    return AGREEMENT_CLAUSES.filter((c) => checkedClauses[c.id]).length;
  }, [checkedClauses]);

  const allAgreed = checkedCount === totalClauses;
  const progressPercent = Math.round((checkedCount / totalClauses) * 100);

  const toggleClause = useCallback((id) => {
    setCheckedClauses((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  }, []);

  const handleSelectAllToggle = useCallback(() => {
    if (allAgreed) {
      setCheckedClauses({});
    } else {
      const allChecked = {};
      AGREEMENT_CLAUSES.forEach((c) => {
        allChecked[c.id] = true;
      });
      setCheckedClauses(allChecked);
    }
  }, [allAgreed]);

  const handleAccept = async () => {
    if (!allAgreed || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const digitalAgreementPayload = {
        agreed: true,
        agreedAt: new Date().toISOString(),
        status: "agree",
        items: AGREEMENT_CLAUSES.map((c) => c.title),
        version: "1.0",
      };
      await onAccept(digitalAgreementPayload);
    } catch (error) {
      console.error("Error submitting digital agreement:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const traineeId =
    internData?.Trainee_ID ||
    internData?.traineeId ||
    localStorage.getItem("internId") ||
    "N/A";
  const email =
    internData?.Trainee_Email ||
    internData?.email ||
    "intern@slt.lk";
  const institute =
    internData?.Institute || internData?.institute || "SLT Training Center";
  const specialization =
    internData?.field_of_spec_name ||
    internData?.fieldOfSpecialization ||
    "Internship Candidate";

  const todayFormatted = new Date().toLocaleDateString("en-US", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  // Profile image: use localStorage internId (guaranteed correct MongoDB ObjectId from login)
  // Cache-bust with a stable timestamp so the browser doesn't serve a stale 404 response
  const storedInternId = localStorage.getItem("internId") || "";
  const rawInternId = storedInternId ||
    (typeof internData?._id === "string" ? internData._id : "") ||
    internData?.id ||
    "";

  const fallbackAvatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(
    internName || "Intern"
  )}&background=000066&color=ffffff&bold=true`;

  // Priority: 1) Backend endpoint (serves uploaded DB picture first, then redirects to Google pic)
  //           2) Direct googlePictureUrl / picture
  //           3) ui-avatars fallback
  const endpointUrl = rawInternId
    ? `${API_BASE_URL}${API_ENDPOINTS.INTERNS.LIST}/${rawInternId}/profile-picture`
    : "";
  const googleUrl = internData?.googlePictureUrl || internData?.picture || "";
  
  const profilePicUrl = profileImgError
    ? fallbackAvatarUrl
    : (endpointUrl || googleUrl || fallbackAvatarUrl);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 lg:p-6 bg-slate-900/50 overflow-y-auto overscroll-contain">
      {/* Horizontal & Fully Responsive Modal Container */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-6xl xl:max-w-7xl max-h-[94vh] md:h-[90vh] md:max-h-[860px] my-auto flex flex-col md:flex-row overflow-y-auto md:overflow-hidden transform-gpu">
        
        {/* Left Sidebar - Profile Summary & Progress */}
        <div className="w-full md:w-[350px] lg:w-[390px] bg-slate-50/95 border-b md:border-b-0 md:border-r border-slate-200 p-4 sm:p-5 lg:p-6 flex flex-col justify-between flex-shrink-0 md:overflow-y-auto">
          <div className="space-y-4">
            {/* Top Brand & Badge */}
            <div>
              <div className="mb-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-300 shadow-2xs">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  TalentHub Digital Verification
                </span>
              </div>
              <h2 className="text-lg sm:text-xl lg:text-2xl font-extrabold text-slate-900 tracking-tight">
                Internship Agreement
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                SLT-Mobitel Internship Code of Conduct
              </p>
            </div>

            {/* Intern Identity Card with Profile Image & Re-ordered Details */}
            <div className="bg-white rounded-xl p-3.5 sm:p-4 border border-slate-200/80 shadow-2xs space-y-3">
              {/* Profile Image, Name, and Email */}
              <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                <img
                  src={profilePicUrl}
                  alt={internName || "Profile"}
                  referrerPolicy="no-referrer"
                  onError={() => {
                    setProfileImgError(true);
                  }}
                  className="w-12 h-12 rounded-xl object-cover border-2 border-slate-200 shadow-2xs flex-shrink-0 bg-slate-100"
                />
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-bold text-slate-900 truncate">
                    {internName || "Intern"}
                  </h3>
                  {/* Under Name: Email */}
                  <p className="text-xs text-slate-500 truncate flex items-center gap-1 mt-0.5" title={email}>
                    <Mail className="w-3 h-3 text-slate-400 flex-shrink-0" />
                    <span className="truncate">{email}</span>
                  </p>
                </div>
              </div>

              {/* Position 1: Trainee ID, Position 2: Institute, Position 3: Specialization, Position 4: Date */}
              <div className="grid grid-cols-2 gap-2 text-xs pt-0.5">
                {/* 1. Trainee ID */}
                <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                  <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                    <IdCard className="w-3 h-3" /> Trainee ID
                  </span>
                  <span className="font-bold text-slate-800 truncate block mt-0.5">
                    {traineeId}
                  </span>
                </div>

                {/* 2. Institute */}
                <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                  <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                    <GraduationCap className="w-3 h-3" /> Institute
                  </span>
                  <span className="font-semibold text-slate-800 truncate block mt-0.5" title={institute}>
                    {institute}
                  </span>
                </div>

                {/* 3. Specialization */}
                <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                  <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                    <Layers className="w-3 h-3" /> Specialization
                  </span>
                  <span className="font-semibold text-slate-800 truncate block mt-0.5" title={specialization}>
                    {specialization}
                  </span>
                </div>

                {/* 4. Date */}
                <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                  <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> Signing Date
                  </span>
                  <span className="font-semibold text-slate-800 truncate block mt-0.5">
                    {todayFormatted}
                  </span>
                </div>
              </div>
            </div>

            {/* Live Progress Widget */}
            <div className="bg-white rounded-xl p-3.5 sm:p-4 border border-slate-200/80 shadow-2xs space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-800">Clauses Acknowledged</span>
                <span
                  className={`px-2 py-0.5 rounded-md font-bold text-xs ${
                    allAgreed
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-slate-100 text-slate-700"
                  }`}
                >
                  {checkedCount} / {totalClauses}
                </span>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-full transition-all duration-150 rounded-full ${
                    allAgreed ? "bg-emerald-500" : "bg-[#000066]"
                  }`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              {/* Select All Toggle Button */}
              <button
                type="button"
                onClick={handleSelectAllToggle}
                className={`w-full py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-colors duration-75 cursor-pointer ${
                  allAgreed
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-100"
                    : "bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200"
                }`}
              >
                {allAgreed ? (
                  <>
                    <CheckSquare className="w-4 h-4 text-emerald-600" />
                    <span>All 8 Clauses Selected</span>
                  </>
                ) : (
                  <>
                    <Square className="w-4 h-4 text-slate-500" />
                    <span>Select All 8 Clauses</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Desktop Left Footer - Action Button & PDF Link */}
          <div className="space-y-2.5 pt-3.5 border-t border-slate-200 mt-4 hidden md:block">
            <div className="flex items-center justify-center gap-1.5 text-center px-1">
              <ShieldCheck className="w-3.5 h-3.5 text-[#000066] flex-shrink-0" />
              <p className="text-[11px] text-slate-600 font-medium leading-tight text-center">
                Agree to all 8 clauses to activate your TalentHub portal access.
              </p>
            </div>

            <button
              type="button"
              onClick={handleAccept}
              disabled={!allAgreed || isSubmitting}
              className={`w-full py-2.5 lg:py-3 px-4 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors duration-75 cursor-pointer ${
                allAgreed && !isSubmitting
                  ? "bg-[#000066] hover:bg-[#00104d] text-white shadow-md hover:shadow-lg"
                  : "bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300"
              }`}
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-slate-300 border-t-white" />
                  <span>Saving Agreement...</span>
                </>
              ) : (
                <>
                  <span>Accept & Continue to TalentHub</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <a
              href={agreementPdf}
              download="Trainee_Guidelines_Agreement.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-1.5 px-3 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 flex items-center justify-center gap-1.5 transition-colors"
            >
              <FileDown className="w-3.5 h-3.5 text-slate-500" />
              <span>Download PDF Guidelines</span>
            </a>
          </div>
        </div>

        {/* Right Panel - Responsive Clauses List */}
        <div className="flex-1 bg-white p-4 sm:p-5 lg:p-7 flex flex-col min-w-0 md:overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between pb-3.5 mb-3.5 border-b border-slate-100 flex-shrink-0">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900">
                Code of Conduct & Internship Terms
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Click each clause card to read and acknowledge compliance.
              </p>
            </div>

            <span className="text-[11px] font-semibold px-2.5 py-1 rounded-md bg-slate-100 text-slate-600 flex-shrink-0">
              8 Clauses Required
            </span>
          </div>

          {/* Clauses List - Rendered with memoized rows for silky 60fps scrolling & zero selection lag */}
          <div className="space-y-2.5 flex-1 md:overflow-y-auto md:pr-1 overscroll-contain">
            {AGREEMENT_CLAUSES.map((clause) => (
              <ClauseRow
                key={clause.id}
                clause={clause}
                isChecked={!!checkedClauses[clause.id]}
                onToggle={toggleClause}
              />
            ))}
          </div>

          {/* Mobile Bottom Action Bar (Only visible on small screens) */}
          <div className="pt-4 mt-4 border-t border-slate-100 flex flex-col gap-2.5 md:hidden">
            <div className="flex items-center justify-center gap-1.5 text-center px-1">
              <ShieldCheck className="w-3.5 h-3.5 text-[#000066] flex-shrink-0" />
              <p className="text-[11px] text-slate-600 font-medium leading-tight text-center">
                Agree to all 8 clauses to activate your TalentHub portal access.
              </p>
            </div>

            <div className="text-xs text-center">
              {!allAgreed ? (
                <span className="text-amber-700 font-medium flex items-center justify-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                  Please agree to all 8 clauses ({totalClauses - checkedCount} remaining)
                </span>
              ) : (
                <span className="text-emerald-700 font-semibold flex items-center justify-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  All 8 clauses agreed. Ready to continue!
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={handleAccept}
              disabled={!allAgreed || isSubmitting}
              className={`w-full py-3 px-4 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors duration-75 cursor-pointer ${
                allAgreed && !isSubmitting
                  ? "bg-[#000066] hover:bg-[#00104d] text-white shadow-md"
                  : "bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300"
              }`}
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-slate-300 border-t-white" />
                  <span>Saving Agreement...</span>
                </>
              ) : (
                <>
                  <span>Accept All & Continue to TalentHub</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <a
              href={agreementPdf}
              download="Trainee_Guidelines_Agreement.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-2 px-3 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 flex items-center justify-center gap-1.5 transition-colors"
            >
              <FileDown className="w-3.5 h-3.5 text-slate-500" />
              <span>Download PDF Guidelines</span>
            </a>
          </div>

          {/* Desktop Bottom Note */}
          <div className="pt-3 mt-3 border-t border-slate-100 hidden md:flex items-center justify-between text-xs text-slate-400 flex-shrink-0">
            <span className="flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5 text-slate-500" />
              SLT Digital Compliance Verification
            </span>
            <span>TalentHub System • Version 1.0</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AgreementModal;
