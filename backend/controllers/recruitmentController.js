const JobOpening = require("../models/JobOpening");
const Applicant = require("../models/Applicant");
const Interview = require("../models/Interview");
const Onboarding = require("../models/Onboarding");
const User = require("../models/User");
const Notification = require("../models/Notification");

// Standard onboarding tasks checklist template
const DEFAULT_ONBOARDING_TASKS = [
  {
    title: "Document Verification (NID/Passport, Academic Certificates)",
    category: "Documentation",
    isCompleted: false,
    notes: "Collect scanned copies and verify identity",
  },
  {
    title: "Employment Agreement & Confidentiality NDA Signing",
    category: "Documentation",
    isCompleted: false,
    notes: "Signed appointment letter submitted to HR",
  },
  {
    title: "IT Equipment & Workstation Provisioning",
    category: "IT Setup",
    isCompleted: false,
    notes: "Laptop, access cards, monitor and peripherals issued",
  },
  {
    title: "Corporate Email & Communication Tools Setup",
    category: "IT Setup",
    isCompleted: false,
    notes: "Setup official email, Slack, GitHub/GitLab access",
  },
  {
    title: "HR Orientation & Company Policy Briefing",
    category: "HR Orientation",
    isCompleted: false,
    notes: "Overview of office timings, leaves, appraisal, and culture",
  },
  {
    title: "Team Introduction & Mentor / Buddy Assignment",
    category: "Team Training",
    isCompleted: false,
    notes: "Introduce to department head and assign primary mentor",
  },
  {
    title: "Development Environment & Project Repositories Setup",
    category: "Team Training",
    isCompleted: false,
    notes: "Clone repos, install dependencies, run local builds",
  },
];

// Helper to notify HR and Admins
const notifyHRAndAdmins = async (tenantId, title, message, linkTab = "recruitment") => {
  try {
    const hrUsers = await User.find({
      tenant: tenantId,
      role: { $in: ["Super Admin", "Admin", "HR"] },
    }).select("_id");

    if (hrUsers.length > 0) {
      await Notification.create({
        tenant: tenantId,
        recipients: hrUsers.map((u) => u._id),
        title,
        message,
        category: "recruitment",
        linkTab,
      });
    }
  } catch (err) {
    console.error("Failed to create recruitment notification:", err.message);
  }
};

// ==========================================
// 1. STATS & ANALYTICS
// ==========================================
exports.getRecruitmentStats = async (req, res) => {
  try {
    const tenantId = req.tenantId;

    const [
      totalJobs,
      publishedJobs,
      totalApplicants,
      screeningCount,
      interviewCount,
      offeredCount,
      hiredCount,
      rejectedCount,
      activeOnboarding,
      completedOnboarding,
    ] = await Promise.all([
      JobOpening.countDocuments({ tenant: tenantId }),
      JobOpening.countDocuments({ tenant: tenantId, status: "Published" }),
      Applicant.countDocuments({ tenant: tenantId }),
      Applicant.countDocuments({ tenant: tenantId, status: "Screening" }),
      Applicant.countDocuments({ tenant: tenantId, status: "Interview" }),
      Applicant.countDocuments({ tenant: tenantId, status: "Offer" }),
      Applicant.countDocuments({ tenant: tenantId, status: "Hired" }),
      Applicant.countDocuments({ tenant: tenantId, status: "Rejected" }),
      Onboarding.countDocuments({ tenant: tenantId, status: { $in: ["Pending", "In Progress"] } }),
      Onboarding.countDocuments({ tenant: tenantId, status: "Completed" }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalJobs,
        publishedJobs,
        totalApplicants,
        pipeline: {
          applied: totalApplicants - (screeningCount + interviewCount + offeredCount + hiredCount + rejectedCount),
          screening: screeningCount,
          interview: interviewCount,
          offer: offeredCount,
          hired: hiredCount,
          rejected: rejectedCount,
        },
        onboarding: {
          active: activeOnboarding,
          completed: completedOnboarding,
        },
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ==========================================
// 2. JOB OPENINGS CONTROLLERS
// ==========================================
exports.getJobOpenings = async (req, res) => {
  try {
    const { status, department, employmentType, search } = req.query;
    const filter = { tenant: req.tenantId };

    if (status && status !== "All") filter.status = status;
    if (department && department !== "All") filter.department = department;
    if (employmentType && employmentType !== "All") filter.employmentType = employmentType;
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { department: { $regex: search, $options: "i" } },
        { location: { $regex: search, $options: "i" } },
      ];
    }

    const jobs = await JobOpening.find(filter).sort({ createdAt: -1 }).lean();

    // Attach applicant count to each job
    const jobIds = jobs.map((j) => j._id);
    const applicantCounts = await Applicant.aggregate([
      { $match: { tenant: req.tenantId, job: { $in: jobIds } } },
      { $group: { _id: "$job", count: { $sum: 1 } } },
    ]);
    const countsMap = {};
    applicantCounts.forEach((item) => {
      countsMap[item._id.toString()] = item.count;
    });

    const jobsWithCounts = jobs.map((j) => ({
      ...j,
      applicantCount: countsMap[j._id.toString()] || 0,
    }));

    res.status(200).json({
      success: true,
      data: jobsWithCounts,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getJobOpeningById = async (req, res) => {
  try {
    const job = await JobOpening.findOne({
      _id: req.params.id,
      tenant: req.tenantId,
    }).lean();

    if (!job) {
      return res.status(404).json({ success: false, message: "Job opening not found" });
    }

    const applicants = await Applicant.find({
      job: job._id,
      tenant: req.tenantId,
    }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: {
        ...job,
        applicantCount: applicants.length,
        applicants,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createJobOpening = async (req, res) => {
  try {
    const {
      title,
      department,
      team,
      location,
      employmentType,
      experienceLevel,
      salaryMin,
      salaryMax,
      currency,
      vacancies,
      deadline,
      description,
      requirements,
      responsibilities,
      skillsRequired,
      status,
    } = req.body;

    if (!title || !department || !description) {
      return res.status(400).json({
        success: false,
        message: "Title, Department, and Description are required",
      });
    }

    const job = await JobOpening.create({
      tenant: req.tenantId,
      title,
      department,
      team,
      location: location || "On-site (Dhaka)",
      employmentType: employmentType || "Full-Time",
      experienceLevel: experienceLevel || "Mid Level",
      salaryMin: Number(salaryMin) || 0,
      salaryMax: Number(salaryMax) || 0,
      currency: currency || "BDT",
      vacancies: Number(vacancies) || 1,
      deadline: deadline ? new Date(deadline) : undefined,
      description,
      requirements: Array.isArray(requirements) ? requirements : requirements ? [requirements] : [],
      responsibilities: Array.isArray(responsibilities) ? responsibilities : responsibilities ? [responsibilities] : [],
      skillsRequired: Array.isArray(skillsRequired) ? skillsRequired : skillsRequired ? [skillsRequired] : [],
      status: status || "Published",
      postedBy: req.user?._id,
      postedByName: req.user?.name,
    });

    await notifyHRAndAdmins(
      req.tenantId,
      "New Job Opening Created",
      `${req.user?.name || "HR"} published a new position: ${title} (${department})`
    );

    res.status(201).json({
      success: true,
      data: job,
      message: "Job opening created successfully",
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateJobOpening = async (req, res) => {
  try {
    const job = await JobOpening.findOneAndUpdate(
      { _id: req.params.id, tenant: req.tenantId },
      { $set: req.body },
      { new: true, runValidators: true }
    );

    if (!job) {
      return res.status(404).json({ success: false, message: "Job opening not found" });
    }

    res.status(200).json({
      success: true,
      data: job,
      message: "Job opening updated successfully",
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteJobOpening = async (req, res) => {
  try {
    const job = await JobOpening.findOneAndDelete({
      _id: req.params.id,
      tenant: req.tenantId,
    });

    if (!job) {
      return res.status(404).json({ success: false, message: "Job opening not found" });
    }

    res.status(200).json({
      success: true,
      message: "Job opening deleted successfully",
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ==========================================
// 3. APPLICANT MANAGEMENT CONTROLLERS
// ==========================================
exports.getApplicants = async (req, res) => {
  try {
    const { jobId, status, search, rating } = req.query;
    const filter = { tenant: req.tenantId };

    if (jobId && jobId !== "All") filter.job = jobId;
    if (status && status !== "All") filter.status = status;
    if (rating) filter.rating = { $gte: Number(rating) };
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { currentCompany: { $regex: search, $options: "i" } },
        { skills: { $in: [new RegExp(search, "i")] } },
      ];
    }

    const applicants = await Applicant.find(filter)
      .populate("job", "title department employmentType location status")
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      data: applicants,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getApplicantById = async (req, res) => {
  try {
    const applicant = await Applicant.findOne({
      _id: req.params.id,
      tenant: req.tenantId,
    })
      .populate("job")
      .lean();

    if (!applicant) {
      return res.status(404).json({ success: false, message: "Applicant not found" });
    }

    const interviews = await Interview.find({
      applicant: applicant._id,
      tenant: req.tenantId,
    })
      .populate("interviewers", "name email role")
      .sort({ scheduledAt: 1 })
      .lean();

    const onboarding = await Onboarding.findOne({
      applicant: applicant._id,
      tenant: req.tenantId,
    }).lean();

    res.status(200).json({
      success: true,
      data: {
        ...applicant,
        interviews,
        onboarding,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createApplicant = async (req, res) => {
  try {
    const {
      jobId,
      name,
      email,
      phone,
      currentCompany,
      currentPosition,
      experienceYears,
      education,
      resumeUrl,
      portfolioUrl,
      coverLetter,
      skills,
      source,
    } = req.body;

    if (!jobId || !name || !email) {
      return res.status(400).json({
        success: false,
        message: "Job ID, Name, and Email are required",
      });
    }

    const job = await JobOpening.findOne({ _id: jobId, tenant: req.tenantId });
    if (!job) {
      return res.status(404).json({ success: false, message: "Job opening not found" });
    }

    const applicant = await Applicant.create({
      tenant: req.tenantId,
      job: job._id,
      jobTitle: job.title,
      department: job.department,
      name,
      email,
      phone,
      currentCompany,
      currentPosition,
      experienceYears: Number(experienceYears) || 0,
      education,
      resumeUrl,
      portfolioUrl,
      coverLetter,
      skills: Array.isArray(skills) ? skills : skills ? skills.split(",").map((s) => s.trim()) : [],
      source: source || "Website",
      status: "Applied",
      appliedDate: new Date(),
    });

    await notifyHRAndAdmins(
      req.tenantId,
      "New Application Received",
      `${name} applied for "${job.title}" (${job.department})`
    );

    res.status(201).json({
      success: true,
      data: applicant,
      message: "Application submitted successfully",
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateApplicant = async (req, res) => {
  try {
    const applicant = await Applicant.findOneAndUpdate(
      { _id: req.params.id, tenant: req.tenantId },
      { $set: req.body },
      { new: true, runValidators: true }
    );

    if (!applicant) {
      return res.status(404).json({ success: false, message: "Applicant not found" });
    }

    res.status(200).json({
      success: true,
      data: applicant,
      message: "Applicant updated successfully",
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateApplicantStatus = async (req, res) => {
  try {
    const { status, rejectionReason, rating, notes } = req.body;
    const update = {};

    if (status) update.status = status;
    if (rejectionReason !== undefined) update.rejectionReason = rejectionReason;
    if (rating !== undefined) update.rating = Number(rating);
    if (notes !== undefined) update.notes = notes;

    const applicant = await Applicant.findOneAndUpdate(
      { _id: req.params.id, tenant: req.tenantId },
      { $set: update },
      { new: true }
    );

    if (!applicant) {
      return res.status(404).json({ success: false, message: "Applicant not found" });
    }

    res.status(200).json({
      success: true,
      data: applicant,
      message: `Applicant stage updated to ${status}`,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteApplicant = async (req, res) => {
  try {
    const applicant = await Applicant.findOneAndDelete({
      _id: req.params.id,
      tenant: req.tenantId,
    });

    if (!applicant) {
      return res.status(404).json({ success: false, message: "Applicant not found" });
    }

    // Clean up interviews and onboarding
    await Interview.deleteMany({ applicant: applicant._id });
    await Onboarding.deleteMany({ applicant: applicant._id });

    res.status(200).json({
      success: true,
      message: "Applicant and associated records deleted",
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ==========================================
// 4. INTERVIEWS CONTROLLERS
// ==========================================
exports.getInterviews = async (req, res) => {
  try {
    const { applicantId, jobId, status } = req.query;
    const filter = { tenant: req.tenantId };

    if (applicantId) filter.applicant = applicantId;
    if (jobId) filter.job = jobId;
    if (status && status !== "All") filter.status = status;

    const interviews = await Interview.find(filter)
      .populate("applicant", "name email phone currentCompany status")
      .populate("job", "title department")
      .populate("interviewers", "name email role")
      .sort({ scheduledAt: 1 })
      .lean();

    res.status(200).json({
      success: true,
      data: interviews,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.scheduleInterview = async (req, res) => {
  try {
    const {
      applicantId,
      stage,
      title,
      scheduledAt,
      durationMinutes,
      interviewers,
      type,
      locationOrLink,
      notes,
    } = req.body;

    if (!applicantId || !title || !scheduledAt) {
      return res.status(400).json({
        success: false,
        message: "Applicant ID, Title, and Scheduled Date/Time are required",
      });
    }

    const applicant = await Applicant.findOne({
      _id: applicantId,
      tenant: req.tenantId,
    });

    if (!applicant) {
      return res.status(404).json({ success: false, message: "Applicant not found" });
    }

    // Fetch interviewer names
    let interviewerNames = [];
    if (Array.isArray(interviewers) && interviewers.length > 0) {
      const users = await User.find({ _id: { $in: interviewers } }).select("name");
      interviewerNames = users.map((u) => u.name);
    }

    const interview = await Interview.create({
      tenant: req.tenantId,
      applicant: applicant._id,
      job: applicant.job,
      applicantName: applicant.name,
      applicantEmail: applicant.email,
      jobTitle: applicant.jobTitle,
      stage: stage || "Technical Round",
      title,
      scheduledAt: new Date(scheduledAt),
      durationMinutes: Number(durationMinutes) || 45,
      interviewers: Array.isArray(interviewers) ? interviewers : [],
      interviewerNames,
      type: type || "Online Video (Meet/Zoom)",
      locationOrLink: locationOrLink || "https://meet.google.com/xyz-workforce",
      feedback: notes || "",
      conductedBy: req.user?._id,
    });

    // Automatically transition applicant stage to "Interview" if earlier
    if (applicant.status === "Applied" || applicant.status === "Screening") {
      applicant.status = "Interview";
      await applicant.save();
    }

    await notifyHRAndAdmins(
      req.tenantId,
      `Interview Scheduled: ${applicant.name}`,
      `${title} scheduled on ${new Date(scheduledAt).toLocaleString()}`
    );

    res.status(201).json({
      success: true,
      data: interview,
      message: "Interview scheduled successfully",
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateInterview = async (req, res) => {
  try {
    const interview = await Interview.findOneAndUpdate(
      { _id: req.params.id, tenant: req.tenantId },
      { $set: req.body },
      { new: true, runValidators: true }
    );

    if (!interview) {
      return res.status(404).json({ success: false, message: "Interview not found" });
    }

    res.status(200).json({
      success: true,
      data: interview,
      message: "Interview updated successfully",
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.submitInterviewFeedback = async (req, res) => {
  try {
    const { feedback, rating, recommendation, status } = req.body;

    const interview = await Interview.findOne({
      _id: req.params.id,
      tenant: req.tenantId,
    });

    if (!interview) {
      return res.status(404).json({ success: false, message: "Interview not found" });
    }

    interview.feedback = feedback !== undefined ? feedback : interview.feedback;
    interview.rating = rating !== undefined ? Number(rating) : interview.rating;
    interview.recommendation = recommendation || interview.recommendation;
    interview.status = status || "Completed";
    interview.conductedBy = req.user?._id;
    await interview.save();

    // If rated, also update applicant rating score average
    if (rating) {
      const allInterviews = await Interview.find({
        applicant: interview.applicant,
        rating: { $gt: 0 },
      });
      if (allInterviews.length > 0) {
        const avg =
          allInterviews.reduce((sum, item) => sum + item.rating, 0) / allInterviews.length;
        await Applicant.findByIdAndUpdate(interview.applicant, {
          rating: Math.round(avg * 10) / 10,
        });
      }
    }

    res.status(200).json({
      success: true,
      data: interview,
      message: "Interview feedback and evaluation recorded",
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteInterview = async (req, res) => {
  try {
    const interview = await Interview.findOneAndDelete({
      _id: req.params.id,
      tenant: req.tenantId,
    });

    if (!interview) {
      return res.status(404).json({ success: false, message: "Interview not found" });
    }

    res.status(200).json({
      success: true,
      message: "Interview removed successfully",
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ==========================================
// 5. CANDIDATE SELECTION & OFFER
// ==========================================
exports.makeOffer = async (req, res) => {
  try {
    const { applicantId, offeredSalary, joiningDate, designation, notes } = req.body;

    const applicant = await Applicant.findOne({
      _id: applicantId,
      tenant: req.tenantId,
    });

    if (!applicant) {
      return res.status(404).json({ success: false, message: "Applicant not found" });
    }

    applicant.status = "Offer";
    applicant.offerDetails = {
      offeredSalary: Number(offeredSalary) || 0,
      joiningDate: joiningDate ? new Date(joiningDate) : undefined,
      designation: designation || applicant.jobTitle,
      status: "Pending",
      notes: notes || "Official job offer extended to candidate",
    };
    await applicant.save();

    await notifyHRAndAdmins(
      req.tenantId,
      `Offer Extended: ${applicant.name}`,
      `Offer sent for position ${designation || applicant.jobTitle} with salary BDT ${offeredSalary}`
    );

    res.status(200).json({
      success: true,
      data: applicant,
      message: "Offer extended successfully",
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateOfferStatus = async (req, res) => {
  try {
    const { offerStatus, notes } = req.body; // "Accepted" or "Declined"

    const applicant = await Applicant.findOne({
      _id: req.params.id,
      tenant: req.tenantId,
    });

    if (!applicant) {
      return res.status(404).json({ success: false, message: "Applicant not found" });
    }

    if (!applicant.offerDetails) {
      applicant.offerDetails = {};
    }
    applicant.offerDetails.status = offerStatus;
    if (notes) applicant.offerDetails.notes = notes;

    if (offerStatus === "Accepted") {
      applicant.status = "Hired";
    } else if (offerStatus === "Declined") {
      applicant.status = "Rejected";
      applicant.rejectionReason = "Candidate declined offer";
    }

    await applicant.save();

    await notifyHRAndAdmins(
      req.tenantId,
      `Candidate Offer Decision: ${applicant.name}`,
      `Candidate has ${offerStatus.toLowerCase()} the offer for ${applicant.jobTitle}`
    );

    res.status(200).json({
      success: true,
      data: applicant,
      message: `Offer status updated to ${offerStatus}`,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ==========================================
// 6. EMPLOYEE ONBOARDING CONTROLLERS
// ==========================================
exports.getOnboardingList = async (req, res) => {
  try {
    const { status, search } = req.query;
    const filter = { tenant: req.tenantId };

    if (status && status !== "All") filter.status = status;
    if (search) {
      filter.$or = [
        { employeeName: { $regex: search, $options: "i" } },
        { employeeEmail: { $regex: search, $options: "i" } },
        { department: { $regex: search, $options: "i" } },
        { designation: { $regex: search, $options: "i" } },
      ];
    }

    const list = await Onboarding.find(filter)
      .populate("applicant", "name email phone resumeUrl")
      .populate("user", "name email role empCode")
      .populate("mentor", "name email role")
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      data: list,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getOnboardingById = async (req, res) => {
  try {
    const onboarding = await Onboarding.findOne({
      _id: req.params.id,
      tenant: req.tenantId,
    })
      .populate("applicant")
      .populate("user", "name email role empCode department")
      .populate("mentor", "name email role")
      .lean();

    if (!onboarding) {
      return res.status(404).json({ success: false, message: "Onboarding record not found" });
    }

    res.status(200).json({
      success: true,
      data: onboarding,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.initiateOnboarding = async (req, res) => {
  try {
    const {
      applicantId,
      employeeName,
      employeeEmail,
      department,
      designation,
      startDate,
      mentorId,
      welcomeNotes,
    } = req.body;

    let candidateName = employeeName;
    let candidateEmail = employeeEmail;
    let candidateDept = department;
    let candidateDesignation = designation;
    let applicantDoc = null;

    if (applicantId) {
      applicantDoc = await Applicant.findOne({
        _id: applicantId,
        tenant: req.tenantId,
      });

      if (applicantDoc) {
        candidateName = candidateName || applicantDoc.name;
        candidateEmail = candidateEmail || applicantDoc.email;
        candidateDept = candidateDept || applicantDoc.department;
        candidateDesignation =
          candidateDesignation ||
          applicantDoc.offerDetails?.designation ||
          applicantDoc.jobTitle;
      }
    }

    if (!candidateName || !candidateEmail) {
      return res.status(400).json({
        success: false,
        message: "Employee Name and Email are required",
      });
    }

    // Check if user already exists or create new user
    let user = await User.findOne({ email: candidateEmail.toLowerCase() });
    if (!user) {
      // Generate employee code
      const empCount = await User.countDocuments({ tenant: req.tenantId });
      const empCode = `EMP-${String(empCount + 1).padStart(3, "0")}`;

      user = await User.create({
        tenant: req.tenantId,
        name: candidateName,
        email: candidateEmail.toLowerCase(),
        password: "password123", // Default onboarding password
        role: "Member",
        department: candidateDept || "Engineering",
        dept: candidateDept || "Engineering",
        designation: candidateDesignation || "Software Engineer",
        empCode,
        isActive: true,
      });
    }

    // Check mentor details
    let mentorName = "";
    if (mentorId) {
      const mentorUser = await User.findById(mentorId);
      if (mentorUser) mentorName = mentorUser.name;
    }

    // Prepare checklist with default tasks
    const checklist = DEFAULT_ONBOARDING_TASKS.map((task) => ({
      ...task,
      assignedTo: req.user?._id,
      assignedToName: req.user?.name || "HR Manager",
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
    }));

    const onboarding = await Onboarding.create({
      tenant: req.tenantId,
      applicant: applicantDoc ? applicantDoc._id : undefined,
      user: user._id,
      employeeName: candidateName,
      employeeEmail: candidateEmail.toLowerCase(),
      department: candidateDept,
      designation: candidateDesignation,
      startDate: startDate ? new Date(startDate) : new Date(),
      mentor: mentorId || undefined,
      mentorName,
      status: "In Progress",
      progressPercentage: 0,
      checklist,
      welcomeNotes: welcomeNotes || `Welcome to the team, ${candidateName}! We are thrilled to have you with us.`,
    });

    if (applicantDoc) {
      applicantDoc.onboardingInitiated = true;
      applicantDoc.status = "Hired";
      await applicantDoc.save();
    }

    await notifyHRAndAdmins(
      req.tenantId,
      `Onboarding Initiated: ${candidateName}`,
      `Employee onboarding in progress for ${candidateName} (${candidateDept})`
    );

    res.status(201).json({
      success: true,
      data: onboarding,
      message: "Employee onboarding initiated successfully",
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateOnboardingTask = async (req, res) => {
  try {
    const { onboardingId, taskId } = req.params;
    const { isCompleted, notes } = req.body;

    const onboarding = await Onboarding.findOne({
      _id: onboardingId,
      tenant: req.tenantId,
    });

    if (!onboarding) {
      return res.status(404).json({ success: false, message: "Onboarding record not found" });
    }

    const task = onboarding.checklist.id(taskId);
    if (!task) {
      return res.status(404).json({ success: false, message: "Onboarding task not found" });
    }

    if (isCompleted !== undefined) {
      task.isCompleted = Boolean(isCompleted);
      task.completedAt = task.isCompleted ? new Date() : undefined;
    }
    if (notes !== undefined) task.notes = notes;

    // Recalculate progress percentage
    const total = onboarding.checklist.length;
    const completed = onboarding.checklist.filter((t) => t.isCompleted).length;
    onboarding.progressPercentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    if (onboarding.progressPercentage === 100) {
      onboarding.status = "Completed";
      onboarding.completedDate = new Date();
    } else {
      onboarding.status = "In Progress";
      onboarding.completedDate = undefined;
    }

    await onboarding.save();

    res.status(200).json({
      success: true,
      data: onboarding,
      message: "Onboarding task updated",
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.addOnboardingTask = async (req, res) => {
  try {
    const { onboardingId } = req.params;
    const { title, category, assignedTo, assignedToName, dueDate, notes } = req.body;

    if (!title) {
      return res.status(400).json({ success: false, message: "Task title is required" });
    }

    const onboarding = await Onboarding.findOne({
      _id: onboardingId,
      tenant: req.tenantId,
    });

    if (!onboarding) {
      return res.status(404).json({ success: false, message: "Onboarding record not found" });
    }

    onboarding.checklist.push({
      title,
      category: category || "Documentation",
      assignedTo: assignedTo || req.user?._id,
      assignedToName: assignedToName || req.user?.name,
      dueDate: dueDate ? new Date(dueDate) : undefined,
      notes: notes || "",
      isCompleted: false,
    });

    const total = onboarding.checklist.length;
    const completed = onboarding.checklist.filter((t) => t.isCompleted).length;
    onboarding.progressPercentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    await onboarding.save();

    res.status(200).json({
      success: true,
      data: onboarding,
      message: "Checklist task added",
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteOnboardingTask = async (req, res) => {
  try {
    const { onboardingId, taskId } = req.params;

    const onboarding = await Onboarding.findOne({
      _id: onboardingId,
      tenant: req.tenantId,
    });

    if (!onboarding) {
      return res.status(404).json({ success: false, message: "Onboarding record not found" });
    }

    onboarding.checklist.pull({ _id: taskId });

    const total = onboarding.checklist.length;
    const completed = onboarding.checklist.filter((t) => t.isCompleted).length;
    onboarding.progressPercentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    await onboarding.save();

    res.status(200).json({
      success: true,
      data: onboarding,
      message: "Checklist task removed",
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
