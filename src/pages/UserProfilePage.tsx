import { useEffect, useState } from 'react';
import LogoBlockComp from '../components/LogoBlockComp';
import BackButton from '../components/BackButton';
import { useGlobalState } from '../GlobalState';
import { UserProfile } from '../../common/CommonTypes';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUser } from '@fortawesome/free-solid-svg-icons';
import PublicKeyComp from '../components/PublicKeyComp';
import Markdown from '../components/MarkdownComp';
import LoadingIndicatorComp from '../components/LoadingIndicatorComp';

export default function UserProfilePage() {
    const { userProfile } = useGlobalState();
    const [profileData, setProfileData] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchUserProfile = async () => {
            if (!userProfile?.publicKey) {
                setError("No public key provided");
                setLoading(false);
                return;
            }
    
            try {
                setLoading(true);
                // Use the correct endpoint from the server code
                const response = await fetch(`/api/users/${userProfile.publicKey}/info`);
                
                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
                
                const data = await response.json();
                
                // Transform the server response into the format we need for UserProfile
                const profileData: UserProfile = {
                    name: data.userName || "",
                    description: data.userDesc || "",
                    avatar: data.avatar,
                    publicKey: userProfile.publicKey
                };
                
                setProfileData(profileData);
                setError(null);
            } catch (err) {
                console.error("Error fetching user profile:", err);
                setError("Failed to load user profile");
            } finally {
                setLoading(false);
            }
        };
    
        fetchUserProfile();
    }, [userProfile?.publicKey]);

    return (
        <div className="page-container">
            <header className="app-header">
                <LogoBlockComp subText="User Profile"/>
                <div className="flex items-center space-x-4">
                    <BackButton/>
                </div>
            </header>
            <div id="userProfile" className="flex-grow overflow-y-auto p-4 bg-gray-900">
                <div className="space-y-6 max-w-2xl mx-auto">
                    {loading ? (
                        <div className="flex justify-center items-center h-64">
                            <LoadingIndicatorComp />
                        </div>
                    ) : error ? (
                        <div className="bg-red-900/30 text-red-300 p-4 rounded-lg text-center">
                            <p>{error}</p>
                        </div>
                    ) : profileData ? (
                        <div className="bg-gray-800 rounded-lg shadow-lg p-6">
                            {/* Avatar and Name Section */}
                            <div className="flex flex-col sm:flex-row items-center gap-6 mb-6">
                                {/* Avatar */}
                                <div className="w-32 h-32 rounded-full overflow-hidden bg-gray-700 flex-shrink-0">
                                    {profileData.avatar ? (
                                        <img 
                                            src={profileData.avatar.data} 
                                            alt={`${profileData.name}'s avatar`}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-gray-500 bg-gray-700">
                                            <FontAwesomeIcon icon={faUser} className="text-4xl" />
                                        </div>
                                    )}
                                </div>
                                
                                {/* Name and Public Key */}
                                <div className="flex-grow text-center sm:text-left">
                                    <h1 className="text-2xl font-bold text-white mb-2">{profileData.name || "Unnamed User"}</h1>
                                    <div className="bg-gray-700 p-2 rounded text-sm text-gray-300 overflow-hidden">
                                        <div className="font-semibold mb-1">Public Key:</div>
                                        <PublicKeyComp publicKey={profileData.publicKey} />
                                    </div>
                                </div>
                            </div>
                            
                            {/* Description Section */}
                            <div className="mt-6">
                                <h2 className="text-xl font-semibold text-white mb-3">About</h2>
                                <div className="bg-gray-700 p-4 rounded-lg text-gray-200">
                                    {profileData.description ? (
                                        <Markdown markdownContent={profileData.description} />
                                    ) : (
                                        <p className="text-gray-400 italic">No description provided</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-gray-800 p-4 rounded-lg text-center text-gray-400">
                            <p>No profile data available</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
