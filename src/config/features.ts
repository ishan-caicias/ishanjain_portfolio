export function isSpaceSceneEnabled(value: string | undefined): boolean {
  return value !== "false";
}

export const features = {
  spaceScene: isSpaceSceneEnabled(import.meta.env.PUBLIC_SPACE_SCENE),
} as const;
