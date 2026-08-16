// A blue checkmark for verification is a near-universal UI pattern —
// Twitter/X, TikTok, YouTube, and Instagram/Facebook all use some
// version of it. This is GTAHUB's own rendering (a plain inline SVG,
// not an imported icon asset), not a copy of any platform's specific
// badge artwork.
export default function VerifiedBadge({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      role="img"
      aria-label="Verified"
      className="inline-block shrink-0"
    >
      <path
        d="M10 0l2.163 1.5 2.59-.393 1.088 2.393 2.393 1.088-.393 2.59L19.5 10l-1.5 2.163.393 2.59-2.393 1.088-1.088 2.393-2.59-.393L10 20l-2.163-1.5-2.59.393-1.088-2.393-2.393-1.088.393-2.59L.5 10l1.5-2.163-.393-2.59 2.393-1.088L5.088 1.5l2.59.393L10 0z"
        fill="#3B9EFF"
      />
      <path
        d="M6 10.2l2.4 2.4 5.2-5.6"
        stroke="#0B0B12"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}
