export const AppIcon = () => (
  <svg className="app-icon" viewBox="0 0 512 512" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id="gBg2" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#0f172a" />
        <stop offset="100%" stopColor="#1e3a8a" />
      </linearGradient>
      <linearGradient id="gPath" x1="0" y1="1" x2="1" y2="0">
        <stop offset="0%" stopColor="#2563eb" />
        <stop offset="100%" stopColor="#10b981" />
      </linearGradient>
      <linearGradient id="gCoin" x1="0.15" y1="0" x2="0.85" y2="1">
        <stop offset="0%" stopColor="#fff3b0" />
        <stop offset="28%" stopColor="#ffd54a" />
        <stop offset="55%" stopColor="#f5a524" />
        <stop offset="100%" stopColor="#b45309" />
      </linearGradient>
      <linearGradient id="gCoinTop" x1="0" y1="0" x2="0.6" y2="1">
        <stop offset="0%" stopColor="#ffe89a" />
        <stop offset="100%" stopColor="#f2b431" />
      </linearGradient>
      <linearGradient id="gRim" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#8a4b06" />
        <stop offset="100%" stopColor="#6b3504" />
      </linearGradient>
    </defs>
    <rect width="512" height="512" rx="112" fill="url(#gBg2)" />
    <rect x="112" y="312" width="72" height="112" rx="24" fill="#2563eb" />
    <rect x="220" y="248" width="72" height="176" rx="24" fill="#3b82f6" />
    <rect x="328" y="184" width="72" height="240" rx="24" fill="#10b981" />
    <path
      d="M148 292 L256 228 L364 164"
      fill="none"
      stroke="url(#gPath)"
      strokeWidth="20"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <ellipse cx="364" cy="158" rx="54" ry="54" fill="url(#gRim)" />
    <ellipse cx="364" cy="150" rx="54" ry="54" fill="url(#gCoin)" />
    <ellipse cx="364" cy="150" rx="43" ry="43" fill="none" stroke="#a86506" strokeWidth="4" opacity="0.55" />
    <ellipse cx="364" cy="150" rx="34" ry="34" fill="url(#gCoinTop)" />
    <ellipse cx="344" cy="126" rx="18" ry="10" fill="#ffffff" opacity="0.5" transform="rotate(-32 344 126)" />
    <g
      fill="none"
      stroke="#7a4205"
      strokeWidth="7"
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity="0.92"
    >
      <path d="M354 128 v44" />
      <path d="M354 128 h13 a11 11 0 0 1 0 22 h-13" />
      <path d="M346 152 h26" />
    </g>
  </svg>
);
