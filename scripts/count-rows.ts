import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
async function main() {
  const [c,cs,cha,cp,pr,pre,prc,ha,ucp,rat,rev,up,uf] = await Promise.all([
    p.course.count(), p.courseSchedule.count(), p.courseHubArea.count(),
    p.coursePrerequisite.count(), p.program.count(), p.programRequirement.count(),
    p.programRequirementCourse.count(), p.hubArea.count(), p.userCourseProgress.count(),
    p.professorRating.count(), p.professorReview.count(), p.userProfile.count(), p.userProgram.count(),
  ]);
  console.log({ courses:c, schedules:cs, hubLinks:cha, prereqs:cp, programs:pr,
    requirements:pre, reqCourses:prc, hubAreas:ha, progress:ucp,
    professors:rat, reviews:rev, userProfiles:up, userPrograms:uf });
  await p.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
