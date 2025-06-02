import React from "react";
import { ArrowRight, Server, FileText, Activity, Clock, Wrench, Shield, BarChart } from "lucide-react";

export default function Homepage({ onNavigate }) {
  return (
    <div className="space-y-12 py-6">
      {/* Hero section */}
      <section className="text-center space-y-6">
        <h1 className="text-4xl md:text-5xl font-bold">
          <span className="block">TYPO3 Upgrade Assistant</span>
          <span className="text-[rgb(249,115,22)]">Personalize Your Upgrade Journey</span>
        </h1>
        <p className="text-xl text-gray-600 max-w-3xl mx-auto">
          A comprehensive toolkit to analyze your TYPO3 installation, let you personalize the experience with manual analysys and plan your upgrade path.
        </p>
        <div className="flex flex-wrap justify-center gap-4 mt-6">
          <button 
            onClick={() => onNavigate('analysis')}
            className="px-6 py-3 bg-[rgb(249,115,22)] text-white rounded-md hover:bg-[rgb(234,88,12)] transition-colors flex items-center gap-2"
          >
            Analyze Your Site <ArrowRight size={18} />
          </button>
          <button
            onClick={() => onNavigate('versions')}
            className="px-6 py-3 border border-[rgb(249,115,22)] text-[rgb(249,115,22)] rounded-md hover:bg-orange-50 transition-colors"
          >
            Browse TYPO3 Versions
          </button>
        </div>
      </section>

      {/* Feature blocks */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-8">

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
          <div className="w-14 h-14 bg-orange-100 rounded-full flex items-center justify-center mb-4">
            <FileText className="w-7 h-7 text-[rgb(249,115,22)]" />
          </div>
          <h3 className="text-xl font-bold mb-2">Upgrade Path</h3>
          <p className="text-gray-600">
            Get a step-by-step upgrade path from your current TYPO3 version to your target version,
            with detailed instructions for each stage.
          </p>
          <button 
            onClick={() => onNavigate('analysis')}
            className="mt-4 text-[rgb(249,115,22)] font-medium flex items-center gap-1 hover:underline"
          >
            Plan Upgrade <ArrowRight size={16} />
          </button>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
          <div className="w-14 h-14 bg-orange-100 rounded-full flex items-center justify-center mb-4">
            <Activity className="w-7 h-7 text-[rgb(249,115,22)]" />
          </div>
          <h3 className="text-xl font-bold mb-2">Version Info</h3>
          <p className="text-gray-600">
            Browse all TYPO3 versions, including release dates, system requirements, 
            and support timelines to make informed upgrade decisions.
          </p>
          <button 
            onClick={() => onNavigate('versions')}
            className="mt-4 text-[rgb(249,115,22)] font-medium flex items-center gap-1 hover:underline"
          >
            View Versions <ArrowRight size={16} />
          </button>
        </div>
      </section>

      {/* Benefits section */}
      <section className="bg-orange-50 rounded-xl p-8">
        <h2 className="text-2xl font-bold mb-6 text-center">Why Use Our Upgrade Tool?</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex items-start gap-3">
            <div className="bg-white p-2 rounded-full shadow-sm">
              <Clock className="w-5 h-5 text-[rgb(249,115,22)]" />
            </div>
            <div>
              <h3 className="font-bold text-lg">Save Time</h3>
              <p className="text-gray-600">Automate your upgrade planning process and avoid manual research</p>
            </div>
          </div>
          
          <div className="flex items-start gap-3">
            <div className="bg-white p-2 rounded-full shadow-sm">
              <Wrench className="w-5 h-5 text-[rgb(249,115,22)]" />
            </div>
            <div>
              <h3 className="font-bold text-lg">Reduce Complexity</h3>
              <p className="text-gray-600">Get clear, step-by-step instructions for each upgrade stage</p>
            </div>
          </div>
          
          <div className="flex items-start gap-3">
            <div className="bg-white p-2 rounded-full shadow-sm">
              <Shield className="w-5 h-5 text-[rgb(249,115,22)]" />
            </div>
            <div>
              <h3 className="font-bold text-lg">Minimize Risk</h3>
              <p className="text-gray-600">Identify compatibility issues before you start the upgrade process</p>
            </div>
          </div>
          
          <div className="flex items-start gap-3">
            <div className="bg-white p-2 rounded-full shadow-sm">
              <BarChart className="w-5 h-5 text-[rgb(249,115,22)]" />
            </div>
            <div>
              <h3 className="font-bold text-lg">Plan Resources</h3>
              <p className="text-gray-600">Better estimate the effort required for your upgrade project</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA section */}
      <section className="text-center bg-[rgb(249,115,22)] text-white p-12 rounded-xl">
        <h2 className="text-3xl font-bold mb-4">Ready to Upgrade Your TYPO3 Site?</h2>
        <p className="text-xl mb-6 max-w-2xl mx-auto">
          Start by analyzing your site or planning your upgrade path today.
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <button 
            onClick={() => onNavigate('analysis')}
            className="px-6 py-3 bg-white text-[rgb(249,115,22)] rounded-md hover:bg-gray-100 transition-colors"
          >
            Analyze My Site
          </button>
          <button 
            onClick={() => onNavigate('path')}
            className="px-6 py-3 border border-white text-white rounded-md hover:bg-[rgb(234,88,12)] transition-colors"
          >
            Plan Upgrade Path
          </button>
        </div>
      </section>
    </div>
  );
} 