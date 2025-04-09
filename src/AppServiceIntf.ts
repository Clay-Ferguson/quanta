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

// todo-0: this is wrong. Just use `export interface` above and remove the `export default` below
export default AppServiceIntf;
