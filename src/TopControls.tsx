import { useGlobalState, useGlobalDispatch } from './GlobalState';

const TopControls = () => {
    const globalState = useGlobalState();
    const dispatch = useGlobalDispatch();

    const handleIncrement = () => {
        dispatch({ type: 'INCREMENT' });
    };

    const handleSetData = () => {
        dispatch({ type: 'SET_SOME_DATA', payload: 'New Data from MyComponent' });
    };

    const handleLogin = () => {
        dispatch({ type: 'LOGIN', payload: { id: 2, name: 'Jane Doe' } });
    };

    const handleLogout = () => {
        dispatch({ type: 'LOGOUT' });
    };

    return (
        <div>
            <h1>My Component</h1>
            <p>Some Global Data: {globalState.someData}</p>
            <p>Count: {globalState.count}</p>
            {globalState.user ? (
                <p>Logged in as: {globalState.user.name}</p>
            ) : (
                <p>Not logged in</p>
            )}
            <button onClick={handleIncrement}>Increment Global Count</button>
            <button onClick={handleSetData}>Set Global Data</button>
            {!globalState.user ? (
                <button onClick={handleLogin}>Login Globally</button>
            ) : (
                <button onClick={handleLogout}>Logout Globally</button>
            )}
        </div>
    );
};

export default TopControls;