import React from 'react';

// Outline gavel icon for regulations section (consistent with other icons)
export const GavelIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} {...props}>
    {/* Gavel head */}
    <path d="M14.5 3.5 20.5 9.5 18 12 12 6 14.5 3.5Z" strokeLinejoin="round" />
    {/* Head cap */}
    <path d="M11 6.5 13.5 4 17.5 8 15 10.5 11 6.5Z" strokeLinejoin="round" />
    {/* Handle */}
    <path d="M5 19 12.5 11.5" strokeLinecap="round" />
    {/* Base */}
    <path d="M2 21h12" strokeLinecap="round" />
  </svg>
);