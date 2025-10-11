import React from 'react';

// A simple gavel icon to represent laws/regulations
export const GavelIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 4.5 3.348 3.348M11.25 4.5 7.898 7.848M11.25 4.5 4.5 11.25m11.25-3.375c.621 1.621.304 3.488-.874 4.666l-3.348 3.348a1.125 1.125 0 0 1-1.591 0l-5.25-5.25a1.125 1.125 0 0 1 0-1.591l3.348-3.348c1.178-1.178 3.045-1.495 4.666-.874Zm-8.25 8.25 5.25 5.25" />
  </svg>
);