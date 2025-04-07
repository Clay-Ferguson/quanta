interface AppServiceIntf {
    /**
     * Handle RTC state changes
     */
    _rtcStateChange(): void;

    /**
     * Persist a message to storage
     * @param msg The message to persist
     */
    _persistMessage(msg: any): Promise<void>;
}

export default AppServiceIntf;
