export function isSpaceSceneEnabled(value: string | undefined): boolean {
  return value === "true";
}

export const features = {
  spaceScene: isSpaceSceneEnabled(import.meta.env.PUBLIC_SPACE_SCENE),
} as const;
