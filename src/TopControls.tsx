import { useGlobalState } from './GlobalState';
import { div } from './DOM'
import './styles/components/TopControls.scss'; 

const TopControls = () => {
    const gs = useGlobalState();

    let participants;
    if (gs.participants.size === 0) {
        participants = 'QuantaChat: No participants yet';
    } else {
        participants = 'QuantaChat with: ' + Array.from(gs.participants).join(', ');
    }

    return (
        div({className: "top-controls"}, participants)
    );
};

export default TopControls;