import React from 'react';
import { Home, Users, GraduationCap } from 'lucide-react';
import bgImg from '../images/bgImg.jpg';

function AboutPage() {
  return (
    <div className="min-h-screen pt-24 px-6 bg-cover bg-center" style={{ backgroundImage: `url(${bgImg})` }}>
      <div className="max-w-5xl mx-auto">
        <h1 className="text-4xl font-bold text-center mb-12 text-white">About CareerCatalyst</h1>
        <p className="text-lg text-white mb-8 text-center">
          CareerCatalyst is a comprehensive platform designed to bridge the gap between students, institutions, and organizations.
          Our mission is to empower career development through smart technology, intuitive design, and meaningful connections.
        </p>
        <div className="grid md:grid-cols-3 gap-8 mt-12">
          <FeatureCard
            icon={<GraduationCap className="w-10 h-10 text-blue-600" />}
            title="Empowering Students"
            description="We help students discover opportunities, match with jobs, and highlight their skills using AI."
          />
          <FeatureCard
            icon={<Users className="w-10 h-10 text-blue-600" />}
            title="Serving Institutions"
            description="Institutions can efficiently manage and track student progress and job placements."
          />
          <FeatureCard
            icon={<Home className="w-10 h-10 text-blue-600" />}
            title="Supporting Organizations"
            description="Organizations can find top talent with advanced resume parsing and profile analysis."
          />
        </div>
      </div>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="bg-gray-100 p-6 rounded-lg shadow-md text-center">
      <div className="flex justify-center mb-4">{icon}</div>
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-gray-600">{description}</p>
    </div>
  );
}

export default AboutPage;
