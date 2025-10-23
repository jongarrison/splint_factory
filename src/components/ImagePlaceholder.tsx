export default function ImagePlaceholder({ className = "" }: { className?: string }) {
  return (
    <svg 
      className={className}
      viewBox="0 0 400 300" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      aria-label="No image available"
    >
      <rect width="400" height="300" fill="#F3F4F6"/>
      <g opacity="0.4">
        {/* Camera icon */}
        <path 
          d="M200 120C186.745 120 176 130.745 176 144C176 157.255 186.745 168 200 168C213.255 168 224 157.255 224 144C224 130.745 213.255 120 200 120Z" 
          fill="#9CA3AF"
        />
        <path 
          d="M168 104C166.895 104 166 104.895 166 106V108H156C151.582 108 148 111.582 148 116V184C148 188.418 151.582 192 156 192H244C248.418 192 252 188.418 252 184V116C252 111.582 248.418 108 244 108H234V106C234 104.895 233.105 104 232 104H168Z" 
          fill="#9CA3AF"
        />
        <path 
          d="M200 112C182.327 112 168 126.327 168 144C168 161.673 182.327 176 200 176C217.673 176 232 161.673 232 144C232 126.327 217.673 112 200 112ZM200 120C213.255 120 224 130.745 224 144C224 157.255 213.255 168 200 168C186.745 168 176 157.255 176 144C176 130.745 186.745 120 200 120Z" 
          fill="#9CA3AF"
        />
      </g>
      <text 
        x="200" 
        y="220" 
        textAnchor="middle" 
        fill="#9CA3AF" 
        fontSize="14" 
        fontFamily="system-ui, -apple-system, sans-serif"
      >
        No image available
      </text>
    </svg>
  );
}
