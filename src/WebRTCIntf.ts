/**
 * Interface defining all public methods of the WebRTC class
 */
export interface WebRTCIntf {
    participants: Set<string>; // Keep track of expected participants in the room
    connected: boolean; // WebSocket connection status

    _connect(userName: string, roomId: string): Promise<void>;
    _disconnect(): void;
    _sendMessage(msg: any): void;
    setSaveToServer(save: boolean): void;
}
