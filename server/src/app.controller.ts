import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AppService } from './app.service';
import type {
  AuthenticatedUser,
  AnnouncementInput,
  CoachWorkoutFeedbackInput,
  ManualPaymentInput,
  MemberStatusInput,
  MemberDiscountInput,
  PersonalWorkoutFeedbackInput,
  ProfileInput,
  SocialPostInput,
  SingleClassPriceInput,
  StudioClassInput,
  TrainingPackageInput,
} from './app.service';
import {
  CoachAuthGuard,
  MemberAuthGuard,
  readSessionCookie,
  SessionAuthGuard,
} from './coach-auth.guard';
import type { AuthenticatedRequest } from './coach-auth.guard';

interface CreateJoinRequestInput {
  name?: unknown;
  email?: unknown;
}

interface AttendanceInput {
  memberId?: unknown;
}

interface AccountInput {
  token?: unknown;
  email?: unknown;
  username?: unknown;
  password?: unknown;
}

interface LoginInput {
  identifier?: unknown;
  password?: unknown;
}

@Controller('api')
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
  getHealth() {
    return this.appService.getHealth();
  }

  @Get('classes')
  @UseGuards(SessionAuthGuard)
  getClasses(@Req() request: AuthenticatedRequest) {
    return this.appService.getClasses(requireAuthenticatedUser(request));
  }

  @Post('classes')
  @UseGuards(CoachAuthGuard)
  createClass(@Body() body: StudioClassInput) {
    return this.appService.createClass(body);
  }

  @Patch('classes/:id')
  @UseGuards(CoachAuthGuard)
  updateClass(@Param('id') id: string, @Body() body: StudioClassInput) {
    return this.appService.updateClass(id, body);
  }

  @Delete('classes/:id')
  @UseGuards(CoachAuthGuard)
  cancelClass(@Param('id') id: string) {
    return this.appService.cancelStudioClass(id);
  }

  @Post('classes/:id/reservations')
  @UseGuards(SessionAuthGuard)
  reserveClass(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.appService.reserveClass(id, requireAuthenticatedUser(request));
  }

  @Delete('classes/:id/reservations')
  @UseGuards(SessionAuthGuard)
  cancelReservation(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.appService.cancelReservation(
      id,
      requireAuthenticatedUser(request),
    );
  }

  @Post('classes/:id/attendance')
  @UseGuards(CoachAuthGuard)
  markClassAttendance(@Param('id') id: string, @Body() body: AttendanceInput) {
    return this.appService.markClassAttendance(id, body.memberId);
  }

  @Post('member/workouts/:classId/read')
  @UseGuards(MemberAuthGuard)
  markWorkoutRead(
    @Req() request: AuthenticatedRequest,
    @Param('classId') classId: string,
  ) {
    return this.appService.markWorkoutRead(
      requireAuthenticatedUser(request),
      classId,
    );
  }

  @Get('studio/announcements')
  @UseGuards(SessionAuthGuard)
  getAnnouncements() {
    return this.appService.getAnnouncements();
  }

  @Post('studio/announcements')
  @UseGuards(CoachAuthGuard)
  createAnnouncement(
    @Req() request: AuthenticatedRequest,
    @Body() body: AnnouncementInput,
  ) {
    return this.appService.createAnnouncement(
      requireAuthenticatedUser(request),
      body,
    );
  }

  @Delete('studio/announcements/:id')
  @UseGuards(CoachAuthGuard)
  removeAnnouncement(@Param('id') id: string) {
    return this.appService.removeAnnouncement(id);
  }

  @Get('studio/social-post')
  @UseGuards(SessionAuthGuard)
  getLatestSocialPost() {
    return this.appService.getLatestSocialPost();
  }

  @Put('studio/social-post')
  @UseGuards(CoachAuthGuard)
  createSocialPost(
    @Req() request: AuthenticatedRequest,
    @Body() body: SocialPostInput,
  ) {
    return this.appService.createSocialPost(
      requireAuthenticatedUser(request),
      body,
    );
  }

  @Get('member/workouts')
  @UseGuards(MemberAuthGuard)
  getMemberWorkoutHistory(@Req() request: AuthenticatedRequest) {
    return this.appService.getMemberWorkoutHistory(
      requireAuthenticatedUser(request),
    );
  }

  @Post('member/workouts/:classId/feedback')
  @UseGuards(MemberAuthGuard)
  savePersonalWorkoutFeedback(
    @Req() request: AuthenticatedRequest,
    @Param('classId') classId: string,
    @Body() body: PersonalWorkoutFeedbackInput,
  ) {
    return this.appService.savePersonalWorkoutFeedback(
      requireAuthenticatedUser(request),
      classId,
      body,
    );
  }

  @Get('studio/members/:id/workouts')
  @UseGuards(CoachAuthGuard)
  getStudioMemberWorkoutHistory(@Param('id') id: string) {
    return this.appService.getStudioMemberWorkoutHistory(id);
  }

  @Put('studio/members/:memberId/workouts/:classId/feedback')
  @UseGuards(CoachAuthGuard)
  saveCoachWorkoutFeedback(
    @Param('memberId') memberId: string,
    @Param('classId') classId: string,
    @Body() body: CoachWorkoutFeedbackInput,
  ) {
    return this.appService.saveCoachWorkoutFeedback(memberId, classId, body);
  }

  @Get('studio/finance')
  @UseGuards(CoachAuthGuard)
  getStudioFinance() {
    return this.appService.getStudioFinance();
  }

  @Patch('studio/pricing')
  @UseGuards(CoachAuthGuard)
  updateSingleClassPrice(@Body() body: SingleClassPriceInput) {
    return this.appService.updateSingleClassPrice(body);
  }

  @Post('studio/packages')
  @UseGuards(CoachAuthGuard)
  createTrainingPackage(@Body() body: TrainingPackageInput) {
    return this.appService.createTrainingPackage(body);
  }

  @Patch('studio/packages/:id')
  @UseGuards(CoachAuthGuard)
  updateTrainingPackage(
    @Param('id') id: string,
    @Body() body: TrainingPackageInput,
  ) {
    return this.appService.updateTrainingPackage(id, body);
  }

  @Delete('studio/packages/:id')
  @UseGuards(CoachAuthGuard)
  deleteTrainingPackage(@Param('id') id: string) {
    return this.appService.deleteTrainingPackage(id);
  }

  @Put('studio/members/:id/discount')
  @UseGuards(CoachAuthGuard)
  setMemberDiscount(
    @Param('id') id: string,
    @Body() body: MemberDiscountInput,
  ) {
    return this.appService.setMemberDiscount(id, body);
  }

  @Delete('studio/members/:id/discount')
  @UseGuards(CoachAuthGuard)
  removeMemberDiscount(@Param('id') id: string) {
    return this.appService.removeMemberDiscount(id);
  }

  @Patch('studio/members/:id/status')
  @UseGuards(CoachAuthGuard)
  updateMemberStatus(@Param('id') id: string, @Body() body: MemberStatusInput) {
    return this.appService.updateMemberStatus(id, body);
  }

  @Post('studio/payments')
  @UseGuards(CoachAuthGuard)
  recordManualPayment(@Body() body: ManualPaymentInput) {
    return this.appService.recordManualPayment(body);
  }

  @Get('member/finance')
  @UseGuards(MemberAuthGuard)
  getMemberFinance(@Req() request: AuthenticatedRequest) {
    return this.appService.getMemberFinance(requireAuthenticatedUser(request));
  }

  @Get('join-requests')
  @UseGuards(CoachAuthGuard)
  getJoinRequests() {
    return this.appService.getJoinRequests();
  }

  @Delete('join-requests/:id')
  @UseGuards(CoachAuthGuard)
  deleteJoinRequest(@Param('id') id: string) {
    return this.appService.deleteJoinRequest(id);
  }

  @Post('join-requests')
  createJoinRequest(@Body() body: CreateJoinRequestInput) {
    return this.appService.createJoinRequest(body);
  }

  @Patch('join-requests/:id/approve')
  @UseGuards(CoachAuthGuard)
  approveJoinRequest(@Param('id') id: string) {
    return this.appService.approveJoinRequest(id);
  }

  @Post('join-requests/:id/invitation')
  @UseGuards(CoachAuthGuard)
  renewInvitation(@Param('id') id: string) {
    return this.appService.renewInvitation(id);
  }

  @Post('auth/activate')
  async activateInvitation(
    @Body() body: AccountInput,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { user, sessionToken } =
      await this.appService.activateInvitation(body);
    response.cookie('yoca_session', sessionToken, this.sessionCookieOptions());
    return user;
  }

  @Post('auth/login')
  async login(
    @Body() body: LoginInput,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { user, sessionToken } = await this.appService.login(body);
    response.cookie('yoca_session', sessionToken, this.sessionCookieOptions());
    return user;
  }

  @Get('auth/me')
  async getCurrentUser(@Req() request: Request) {
    const token = readSessionCookie(request);
    const user = token ? await this.appService.getSessionUser(token) : null;
    if (!user) {
      throw new UnauthorizedException('Authentication required');
    }
    return { ...user, status: 'active' as const };
  }

  @Patch('auth/profile')
  @UseGuards(SessionAuthGuard)
  updateProfile(
    @Req() request: AuthenticatedRequest,
    @Body() body: ProfileInput,
  ) {
    return this.appService.updateProfile(
      requireAuthenticatedUser(request),
      body,
    );
  }

  @Post('auth/logout')
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.appService.logout(readSessionCookie(request));
    response.clearCookie('yoca_session', this.sessionCookieOptions());
    return { status: 'ok' as const };
  }

  private sessionCookieOptions() {
    return {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict' as const,
      path: '/api',
      maxAge: 12 * 60 * 60 * 1000,
    };
  }
}

function requireAuthenticatedUser(
  request: AuthenticatedRequest,
): AuthenticatedUser {
  if (!request.authenticatedUser) {
    throw new UnauthorizedException('Authentication required');
  }
  return request.authenticatedUser;
}
