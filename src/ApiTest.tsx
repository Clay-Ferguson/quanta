import { useEffect, useState } from 'react';

interface ApiResponse {
  message: string;
}

/* NOTE: This is a React Component that can be used to test an API endpoint, to verify server is working */
export function ApiTest() {
    const [data, setData] = useState<ApiResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetch('/api/data')
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                setData(data);
                setLoading(false);
            })
            .catch(error => {
                console.error('Error fetching API:', error);
                setError(error instanceof Error ? error.message : 'An unknown error occurred');
                setLoading(false);
            });
    }, []);

    if (loading) return <div>Loading...</div>;
    if (error) return <div>Error: {error}</div>;
  
    return (
        <div>
            <h2>API Response:</h2>
            <p>{data?.message}</p>
        </div>
    );
}