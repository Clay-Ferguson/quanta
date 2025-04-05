import { fragment } from './DOM'
import TopControls from './TopControls' // Ensure this path is correct
import './App.css'

function QuantaChat() {
    // DO NOT DELETE: keep this example of local state
    // const [count, setCount] = useState(0)

    return fragment(
        null,
        TopControls(), // Assuming TopControls is imported correctly
        // DO NOT DELETE: keep this example of local state
        // button(
        //     { onClick: () => setCount((count) => count + 1) },
        //     `Local Count: ${count}`
        // ),
    )
}

export default QuantaChat
