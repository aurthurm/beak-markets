export type ThemeColors = {
  background: string;
  text: string;
  textSecondary: string;
  grid: string;
  border: string;
  crosshair: string;
  crosshairLabel: string;
  crosshairLabelText: string;
  candleUp: string;
  candleDown: string;
  wickUp: string;
  wickDown: string;
  volumeUp: string;
  volumeDown: string;
  line: string;
};

export type Theme = {
  name: string;
  colors: ThemeColors;
  fontFamily: string;
  fontSize: number;
};
