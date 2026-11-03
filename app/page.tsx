import DurasSite from './DurasSite';
export default function Page(){return <DurasSite previewAdSamplesEnabled={process.env.VERCEL_ENV === 'preview' || process.env.NODE_ENV === 'development'}/>;}
