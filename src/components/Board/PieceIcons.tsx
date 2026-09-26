import React from 'react';
import { PieceColor, PieceType } from '../../types/chess';

export type PieceSetType = 'cburnett' | 'modern';

interface PieceIconProps {
  type: PieceType;
  color: PieceColor;
  set?: PieceSetType;
  className?: string;
  size?: number | string;
}

// 1. Classic cburnett Vector SVG Set (Standard Lichess / Colin M.L. Burnett)
const renderCburnettPiece = (type: PieceType, color: PieceColor) => {
  const isWhite = color === 'w';
  const fill = isWhite ? '#ffffff' : '#262421';
  const stroke = '#181716';
  const innerStroke = isWhite ? '#181716' : '#ffffff';

  switch (type) {
    case 'p': // Pawn
      return (
        <path
          d="m 22.5,9 c -2.21,0 -4,1.79 -4,4 0,0.89 0.29,1.71 0.78,2.38 C 17.33,16.5 16,18.59 16,21 c 0,2.03 0.94,3.84 2.41,5.03 C 15.41,27.09 11,31.58 11,39.5 l 23,0 c 0,-7.92 -4.41,-12.41 -7.41,-13.47 C 28.06,24.84 29,23.03 29,21 29,18.59 27.67,16.5 25.72,15.38 26.21,14.71 26.5,13.89 26.5,13 c 0,-2.21 -1.79,-4 -4,-4 z"
          fill={fill}
          stroke={stroke}
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      );

    case 'r': // Rook
      return (
        <g fill={fill} stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M 9,39 L 36,39 L 36,36 L 9,36 L 9,39 z" />
          <path d="M 12,36 L 12,32 L 33,32 L 33,36 L 12,36 z" />
          <path d="M 11,14 L 11,9 L 15,9 L 15,11 L 20,11 L 20,9 L 25,9 L 25,11 L 30,11 L 30,9 L 34,9 L 34,14" />
          <path d="M 34,14 L 31,17 L 14,17 L 11,14" />
          <path d="M 13,17 L 14,32 L 31,32 L 32,17" />
          {!isWhite && (
            <path
              d="M 14,29.5 L 14,16.5 L 31,16.5 L 31,29.5 L 14,29.5 z"
              fill="none"
              stroke="#ffffff"
              strokeWidth="1"
            />
          )}
        </g>
      );

    case 'n': // Knight
      return (
        <g stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path
            d="M 22,10 C 32.5,11 38.5,18 38,39 L 15,39 C 15,30 25,32.5 23,18"
            fill={fill}
          />
          <path
            d="M 24,18 C 24.38,20.91 18.45,25.37 16,27 C 13,29 13.18,31.34 11,31 C 9.958,30.06 12.41,27.96 11,28 C 10,28 11.19,29.23 10,30 C 9,30 5.997,31 6,26 C 6,24 12,14 12,14 C 12,14 13.89,12.1 14,10.5 C 13.27,7.4 17.5,7 19.5,7 C 21.5,7 23,8 24,10 C 23.5,11.5 22.5,12 21,12 C 19.5,12 19,10.5 19.5,9 C 18,9 15.5,10 16,13 C 18.5,13.5 21.5,12.5 22,10 z"
            fill={fill}
          />
          <circle cx="9.5" cy="25.5" r="1" fill={isWhite ? '#181716' : '#ffffff'} stroke="none" />
        </g>
      );

    case 'b': // Bishop
      return (
        <g stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path
            d="M 9,36 C 12.39,35.03 19.11,36.43 22.5,34 C 25.89,36.43 32.61,35.03 36,36 C 36,36 37.65,36.54 39,38 C 38.32,38.97 37.35,38.99 36,38.5 C 32.61,37.53 25.89,38.96 22.5,37.5 C 19.11,38.96 12.39,37.53 9,38.5 C 7.646,38.99 6.677,38.97 6,38 C 7.354,36.54 9,36 9,36 z"
            fill={fill}
          />
          <path
            d="M 15,32 C 17.5,34.5 27.5,34.5 30,32 C 30.5,30.5 30,30 30,30 C 30,27.5 27.5,26 27.5,26 C 33,24.5 33.5,14.5 22.5,10.5 C 11.5,14.5 12,24.5 17.5,26 C 17.5,26 15,27.5 15,30 C 15,30 14.5,30.5 15,32 z"
            fill={fill}
          />
          <circle cx="22.5" cy="8.5" r="1.5" fill={fill} />
          <path
            d="M 17.5,26 L 27.5,26 M 15,30 L 30,30 M 22.5,15.5 L 22.5,20.5 M 20,18 L 25,18"
            fill="none"
            stroke={innerStroke}
            strokeWidth="1.5"
            strokeLinejoin="miter"
          />
        </g>
      );

    case 'q': // Queen
      return (
        <g stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill={fill}>
          <path d="M 9,26 C 17.5,24.5 30,24.5 36,26 L 38.5,13.5 L 31,25 L 30.7,10.5 L 25.5,24.5 L 22.5,10 L 19.5,24.5 L 14.3,10.5 L 14,25 L 6.5,13.5 L 9,26 z" />
          <path d="M 9,26 C 9,28 10.5,28 11.5,30 C 12.5,31.5 12.5,31 12,33.5 C 10.5,34.5 11,36 11,36 C 9.5,37.5 11,38.5 11,38.5 L 34,38.5 C 34,38.5 35.5,37.5 34,36 C 34,36 34.5,34.5 33,33.5 C 32.5,31 32.5,31.5 33.5,30 C 34.5,28 36,28 36,26" />
          <circle cx="6" cy="12" r="2" />
          <circle cx="14" cy="9" r="2" />
          <circle cx="22.5" cy="8" r="2" />
          <circle cx="31" cy="9" r="2" />
          <circle cx="39" cy="12" r="2" />
          {!isWhite && (
            <path
              d="M 11.5,30 C 17,29 28,29 33.5,30 M 11.5,33.5 C 17,32.5 28,32.5 33.5,33.5 M 11.5,37 C 17,36 28,36 33.5,37"
              fill="none"
              stroke="#ffffff"
              strokeWidth="1"
            />
          )}
        </g>
      );

    case 'k': // King
      return (
        <g stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
          <path d="M 22.5,11.63 L 22.5,6" stroke={isWhite ? stroke : '#ffffff'} />
          <path d="M 20,8 L 25,8" stroke={isWhite ? stroke : '#ffffff'} />
          <path
            d="M 22.5,25 C 22.5,25 27,17.5 25.5,14.5 C 24,11.5 21,11.5 22.5,25 z"
            fill={fill}
          />
          <path
            d="M 12.5,37 C 17.5,34 27.5,34 32.5,37 L 32.5,30 C 32.5,30 41.5,25.5 38.5,19.5 C 34.5,13 25,16 22.5,23.5 C 20,16 10.5,13 6.5,19.5 C 3.5,25.5 12.5,30 12.5,30 L 12.5,37 z"
            fill={fill}
          />
          <path d="M 11.5,30 C 17,27 28,27 33.5,30" stroke={innerStroke} />
          <path d="M 11.5,33.5 C 17,30.5 28,30.5 33.5,33.5" stroke={innerStroke} />
          <path d="M 11.5,37 C 17,34 28,34 33.5,37" stroke={innerStroke} />
        </g>
      );

    default:
      return null;
  }
};

// 2. Modern Minimal Vector SVG Set (Clean Architectural Silhouettes)
const renderModernPiece = (type: PieceType, color: PieceColor) => {
  const isWhite = color === 'w';
  const fill = isWhite ? '#ffffff' : '#1f1e1b';
  const stroke = isWhite ? '#181716' : '#ffffff';
  const strokeWidth = '1.8';

  switch (type) {
    case 'p': // Modern Pawn
      return (
        <g stroke={stroke} strokeWidth={strokeWidth} fill={fill} strokeLinejoin="round">
          <circle cx="22.5" cy="14" r="5" />
          <path d="M 16 38 C 16 26 29 26 29 38 Z" />
          <line x1="13" y1="38" x2="32" y2="38" strokeWidth="2.2" />
        </g>
      );

    case 'r': // Modern Rook
      return (
        <g stroke={stroke} strokeWidth={strokeWidth} fill={fill} strokeLinejoin="round">
          <path d="M 14 38 L 31 38 L 30 18 L 33 18 L 33 12 L 29 12 L 29 15 L 24 15 L 24 12 L 21 12 L 21 15 L 16 15 L 16 12 L 12 12 L 12 18 L 15 18 Z" />
          <line x1="11" y1="38" x2="34" y2="38" strokeWidth="2.2" />
        </g>
      );

    case 'n': // Modern Knight
      return (
        <g stroke={stroke} strokeWidth={strokeWidth} fill={fill} strokeLinejoin="round">
          <path d="M 15 38 L 30 38 L 30 24 C 30 14 24 11 18 11 C 15 11 13 14 13 18 C 13 22 17 23 15 28 Z" />
          <circle cx="18" cy="18" r="1.5" fill={isWhite ? '#181716' : '#ffffff'} stroke="none" />
          <line x1="12" y1="38" x2="33" y2="38" strokeWidth="2.2" />
        </g>
      );

    case 'b': // Modern Bishop
      return (
        <g stroke={stroke} strokeWidth={strokeWidth} fill={fill} strokeLinejoin="round">
          <circle cx="22.5" cy="9" r="2" />
          <path d="M 22.5 13 C 16 17 16 28 17 38 L 28 38 C 29 28 29 17 22.5 13 Z" />
          <line x1="19" y1="22" x2="26" y2="22" stroke={stroke} strokeWidth="1.5" />
          <line x1="13" y1="38" x2="32" y2="38" strokeWidth="2.2" />
        </g>
      );

    case 'q': // Modern Queen
      return (
        <g stroke={stroke} strokeWidth={strokeWidth} fill={fill} strokeLinejoin="round">
          <circle cx="22.5" cy="10" r="2.5" />
          <circle cx="13" cy="13" r="2" />
          <circle cx="32" cy="13" r="2" />
          <path d="M 13 16 L 16 38 L 29 38 L 32 16 L 25 24 L 22.5 14 L 20 24 Z" />
          <line x1="12" y1="38" x2="33" y2="38" strokeWidth="2.2" />
        </g>
      );

    case 'k': // Modern King
      return (
        <g stroke={stroke} strokeWidth={strokeWidth} fill={fill} strokeLinejoin="round">
          <line x1="22.5" y1="6" x2="22.5" y2="12" strokeWidth="2" stroke={stroke} />
          <line x1="19.5" y1="9" x2="25.5" y2="9" strokeWidth="2" stroke={stroke} />
          <path d="M 14 38 L 31 38 C 31 28 34 22 28 16 C 25 13 20 13 17 16 C 11 22 14 28 14 38 Z" />
          <line x1="11" y1="38" x2="34" y2="38" strokeWidth="2.2" />
        </g>
      );

    default:
      return null;
  }
};

export const PieceIcon: React.FC<PieceIconProps> = ({
  type,
  color,
  set = 'cburnett',
  className = '',
  size = '100%'
}) => {
  return (
    <svg
      viewBox="0 0 45 45"
      width={size}
      height={size}
      className={`piece-svg ${className}`}
      style={{ overflow: 'visible', display: 'block' }}
      aria-label={`${color === 'w' ? 'White' : 'Black'} ${type.toUpperCase()}`}
    >
      {set === 'modern' ? renderModernPiece(type, color) : renderCburnettPiece(type, color)}
    </svg>
  );
};
