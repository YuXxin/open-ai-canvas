type CompositionKeyEvent = Pick<KeyboardEvent, "isComposing" | "keyCode">;

export function isComposingKeyEvent(event: CompositionKeyEvent): boolean {
    // Safari may deliver compositionend before the confirming Enter keydown.
    return event.isComposing || event.keyCode === 229;
}
