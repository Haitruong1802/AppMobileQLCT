// Pet render = FlamePet (lửa SVG với ring màu theo level). Lottie đã được thay bằng FlamePet để giảm bundle + ổn định trên Expo Go.
import { PetStage } from '../services/petStages';
import { FlamePet } from './FlamePet';

type Props = {
  stage: PetStage;
  size?: number;
};

export function PetView({ stage, size = 200 }: Props) {
  return <FlamePet size={size} ringColor={stage.color} level={stage.level} />;
}
