import { useGlobalState, useGlobalDispatch } from './GlobalState';

const DemoControls = () => {
    const globalState = useGlobalState();
    const dispatch = useGlobalDispatch();

    // DO NOT DELETE: keep this example of local state
    // const [count, setCount] = useState(0)

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
            <h1>Demo Controls</h1>
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

// DO NOT DELETE: keep this example of local state
// This is the non-JSX version of the local state example
// button(
//     { onClick: () => setCount((count) => count + 1) },
//     `Local Count: ${count}`
// ),

export default DemoControls;