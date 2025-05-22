import React from 'react';
import { Mail, PhoneCall, MapPin } from 'lucide-react';
import bgImg from '../images/bgImg.jpg';

function ContactPage() {
  return (
    <div className="min-h-screen pt-24 px-6 bg-cover bg-center" style={{ backgroundImage: `url(${bgImg})` }}>
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-center mb-12 text-white">Get in Touch</h1>
        <div className="grid md:grid-cols-3 gap-8">
          <ContactCard
            icon={<PhoneCall className="w-8 h-8 text-blue-600" />}
            title="Phone"
            details={['+1 (555) 123-4567', '+1 (555) 987-6543']}
          />
          <ContactCard
            icon={<Mail className="w-8 h-8 text-blue-600" />}
            title="Email"
            details={['info@careercatalyst.com', 'support@careercatalyst.com']}
          />
          <ContactCard
            icon={<MapPin className="w-8 h-8 text-blue-600" />}
            title="Address"
            details={['123 Innovation Drive', 'Silicon Valley, CA 94025']}
          />
        </div>
      </div>
    </div>
  );
}

function ContactCard({ icon, title, details }: { icon: React.ReactNode; title: string; details: string[] }) {
  return (
    <div className="bg-white p-6 rounded-lg shadow-md text-center">
      <div className="flex justify-center mb-4">{icon}</div>
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      {details.map((detail, index) => (
        <p key={index} className="text-gray-600">{detail}</p>
      ))}
    </div>
  );
}

export default ContactPage;
