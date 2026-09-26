export interface ChessBoardTheme {
  id: string;
  name: string;
  light: string;
  dark: string;
}

export const BOARD_THEMES: ChessBoardTheme[] = [
  { id: 'classic-wood', name: 'Classic Wood', light: '#F0D9B5', dark: '#B58863' },
  { id: 'golden-amber', name: 'Golden Amber', light: '#F7E6B5', dark: '#B8860B' },
  { id: 'creme-black', name: 'Cream & Black', light: '#f0e8d0', dark: '#3a3632' },
  { id: 'forest-green', name: 'Forest Green', light: '#EEEED2', dark: '#769656' },
  { id: 'ocean-blue', name: 'Ocean Blue', light: '#DEE3E6', dark: '#8CA2AD' },
  { id: 'spring-green', name: 'Spring Green', light: '#FFFFDD', dark: '#86A666' },
  { id: 'slate-marble', name: 'Slate Marble', light: '#E8E8E8', dark: '#7C7C7C' },
  { id: 'midnight-blue', name: 'Midnight Blue', light: '#D6E4F0', dark: '#3A6EA5' },
  { id: 'amethyst', name: 'Amethyst', light: '#E8E3F0', dark: '#6B5B95' },
  { id: 'glacier', name: 'Glacier', light: '#E3EDF1', dark: '#7A9CAE' }
];

export type BoardThemeId = 
  | 'classic-wood'
  | 'golden-amber'
  | 'creme-black'
  | 'forest-green'
  | 'ocean-blue'
  | 'spring-green'
  | 'slate-marble'
  | 'midnight-blue'
  | 'amethyst'
  | 'glacier'
  | 'green'
  | 'wood';
